/****************************************************************
 * QT Manager — Đồng bộ 2 CHIỀU SỰ KIỆN (lịch) giữa tab "Sync" và app (Firestore jobs)
 * ---------------------------------------------------------------
 * - Khóa theo "Mã sự kiện" (eventId) → KHÔNG tạo bản trùng.
 * - Sheet → app: chỉ cập nhật field LỊCH (ngày/giờ/tên/khách/địa điểm/tỉnh/loại/
 *   trạng thái/links/ghi chú) bằng updateMask → KHÔNG đè band, makeup, hợp đồng,
 *   chuẩn bị… mà Thi nhập trong app.
 * - app → Sheet: sự kiện tạo/sửa trong app sẽ hiện/cập nhật lên tab Sync.
 * - Chống đè: so cột ẩn "SyncAt" với updatedAt của job (bên nào mới hơn thắng phần lịch).
 *
 * ===== CÀI ĐẶT 1 LẦN =====
 * 1. Dán file này vào Apps Script project QT (cùng nơi firestore-sync.gs / vendor-sync.gs).
 * 2. appsscript.json đã có scope: datastore, spreadsheets, script.external_request, script.scriptapp.
 * 3. Chạy hàm `evInstallTriggers` (onEdit tab Sync đẩy ngay + đồng bộ mỗi 10 phút).
 * 4. (hoặc) menu "Sự kiện": ⟳ Đồng bộ ngay.
 *
 * Lưu ý: phần TIỀN (pays) vẫn dùng tab "Hợp đồng" + menu "② Đẩy lên app" của firestore-sync.gs.
 ****************************************************************/

var EV_PROJECT = "qt-manager-c55f4";
var EV_BASE = "https://firestore.googleapis.com/v1/projects/" + EV_PROJECT + "/databases/(default)/documents/";
var EV_SHEET = "Sync";
var EV_SYNCCOL = "SyncAt"; // cột ẩn lưu mốc đồng bộ (= job.updatedAt lần gần nhất)

// field lịch được đồng bộ (KHÔNG đụng các field giàu của app)
var EV_MASK = ["name","type","status","start","end","loc","prov","client","drive","beat","lyrics","note","timeline","updatedAt"];

var EV_TYPE_VI2CODE = {"Ticket":"ticket","Public":"public","Event":"event_checkin","Gameshow":"gameshow","Podcast":"podcast","Quay social":"quay_social","Thu âm":"thu_am","Phỏng vấn/Họp":"phong_van","Chụp hình":"chup_hinh","Livestream":"livestream","Cá nhân":"canhan","Khác":"khac"};
var EV_TYPE_CODE2VI = {}; (function(){for(var k in EV_TYPE_VI2CODE)EV_TYPE_CODE2VI[EV_TYPE_VI2CODE[k]]=k;})();
var EV_ST_VI2CODE = {"Đã chốt":"da_chot","Đang báo giá":"bao_gia","Đang đàm phán":"dam_phan","Đã ký HĐ":"da_ky_hd","Hoàn thành":"hoan_thanh","Đã hủy":"da_huy"};
var EV_ST_CODE2VI = {}; (function(){for(var k in EV_ST_VI2CODE)EV_ST_CODE2VI[EV_ST_VI2CODE[k]]=k;})();

// header tab Sync -> key
var EV_H2K = {"ngày diễn":"date","giờ":"time","tên sự kiện":"title","khách hàng":"client","địa điểm":"venue","tỉnh/thành":"province","loại":"type","trạng thái":"status","link drive":"drive","link beat":"beat","link lyrics":"lyrics","ghi chú":"note","mã sự kiện":"eventId","nguồn":"source","syncat":"syncAt"};

function evTok(){ return ScriptApp.getOAuthToken(); }
function evHead(){ return { Authorization: "Bearer " + evTok() }; }
function evFval(v){ if(v===null||v===undefined||v==="")return{nullValue:null}; if(typeof v==="boolean")return{booleanValue:v}; if(typeof v==="number")return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}; return{stringValue:String(v)}; }
function evFromVal(f){ if(!f)return""; if("stringValue"in f)return f.stringValue; if("integerValue"in f)return Number(f.integerValue); if("doubleValue"in f)return f.doubleValue; if("booleanValue"in f)return f.booleanValue; return""; }
function evPad(n){ n=String(n); return n.length<2?("0"+n):n; }
function evYMD(v){ if(v instanceof Date)return Utilities.formatDate(v,"Asia/Ho_Chi_Minh","yyyy-MM-dd"); var s=String(v||""); var m=s.match(/(\d{4})-(\d{2})-(\d{2})/); if(m)return m[0]; m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m)return m[3]+"-"+evPad(m[2])+"-"+evPad(m[1]); return s.slice(0,10); }
function evTime(v){ if(v instanceof Date)return evPad(v.getHours())+":"+evPad(v.getMinutes()); var m=String(v||"").match(/(\d{1,2}):(\d{2})/); return m?(evPad(m[1])+":"+m[2]):""; }
function evSlug(s){ return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,28); }
function evMkId(date,title){ return "qt_"+String(date).replace(/-/g,"")+"_"+evSlug(title); }
function evIso(date,t){ t=t||"19:00"; return date+"T"+(String(t).length>=4?String(t).slice(0,5):"19:00")+":00+07:00"; }
function evAddH(iso,h){ var d=new Date(iso); d.setHours(d.getHours()+h); return d.toISOString(); }

function evGetSheet(){ var ss=SpreadsheetApp.getActive(); return ss.getSheetByName(EV_SHEET); }
function evReadSheet(){
  var sh=evGetSheet(); if(!sh)throw new Error('Chưa có tab "Sync". Chạy ① Định dạng tab Sync trước.');
  var data=sh.getDataRange().getValues(); var header=(data[0]||[]).map(function(x){return String(x).trim();});
  var col={}; header.forEach(function(h,i){var k=EV_H2K[h.toLowerCase()]; if(k)col[k]=i;});
  // đảm bảo có cột Mã sự kiện + SyncAt
  if(col.eventId===undefined){ sh.getRange(1,header.length+1).setValue("Mã sự kiện"); col.eventId=header.length; header.push("Mã sự kiện"); }
  if(col.syncAt===undefined){ sh.getRange(1,header.length+1).setValue(EV_SYNCCOL); col.syncAt=header.length; header.push(EV_SYNCCOL); }
  return { sh:sh, data:sh.getDataRange().getValues(), col:col, n:header.length };
}

// list jobs từ Firestore (chỉ field cần)
function evListJobs(){
  var out={}, p="";
  do{
    var r=UrlFetchApp.fetch(EV_BASE+"jobs?pageSize=300"+(p?("&pageToken="+p):""),{headers:evHead(),muteHttpExceptions:true});
    var j=JSON.parse(r.getContentText()||"{}");
    (j.documents||[]).forEach(function(doc){ var id=doc.name.split("/").pop(); var o={id:id}; var fs=doc.fields||{}; for(var k in fs)o[k]=evFromVal(fs[k]); out[id]=o; });
    p=j.nextPageToken||"";
  }while(p);
  return out;
}
// patch CHỈ field lịch (giữ nguyên field giàu)
function evWriteMask(id,o){
  var url=EV_BASE+"jobs/"+encodeURIComponent(id)+"?"+EV_MASK.map(function(k){return "updateMask.fieldPaths="+k;}).join("&");
  var f={}; EV_MASK.forEach(function(k){ if(o[k]!==undefined)f[k]=evFval(o[k]); });
  UrlFetchApp.fetch(url,{method:"patch",contentType:"application/json",headers:evHead(),muteHttpExceptions:true,payload:JSON.stringify({fields:f})});
}

function syncEvents(){
  var S=evReadSheet(); var sh=S.sh, col=S.col, data=S.data;
  var jobs=evListJobs();
  function gv(row,key){var i=col[key];return(i===undefined)?"":row[i];}
  var rowById={}; for(var r=1;r<data.length;r++){var id=String(gv(data[r],"eventId")||"").trim(); if(id)rowById[id]=r;}
  var nUp=0,nPull=0,nNew=0;

  // ---- Sheet -> app (đẩy field lịch, masked) ----
  for(var r=1;r<data.length;r++){
    var row=data[r]; var title=String(gv(row,"title")||"").trim(); if(!title)continue;
    var date=evYMD(gv(row,"date")); var tm=evTime(gv(row,"time"))||"19:00";
    var id=String(gv(row,"eventId")||"").trim()||evMkId(date,title);
    var start=evIso(date,tm);
    var job={name:title,type:EV_TYPE_VI2CODE[String(gv(row,"type")||"").trim()]||"khac",status:EV_ST_VI2CODE[String(gv(row,"status")||"").trim()]||"da_chot",
      start:start,end:evAddH(start,2),loc:String(gv(row,"venue")||""),prov:String(gv(row,"province")||""),client:String(gv(row,"client")||""),
      drive:String(gv(row,"drive")||""),beat:String(gv(row,"beat")||""),lyrics:String(gv(row,"lyrics")||""),note:String(gv(row,"note")||""),timeline:String(gv(row,"note")||""),updatedAt:new Date().toISOString()};
    // chỉ đẩy nếu app KHÔNG mới hơn (tránh ghi đè bản app vừa sửa). So syncAt với updatedAt job.
    var jb=jobs[id]; var syncAt=String(gv(row,"syncAt")||"");
    var appNewer = jb && jb.updatedAt && syncAt && (String(jb.updatedAt)>syncAt);
    if(!appNewer){ evWriteMask(id,job); nUp++; if(col.eventId!==undefined)sh.getRange(r+1,col.eventId+1).setValue(id); sh.getRange(r+1,col.syncAt+1).setValue(job.updatedAt); }
    rowById[id]=r;
  }

  // ---- app -> Sheet (sự kiện app tạo/sửa) ----
  var data2=sh.getDataRange().getValues();
  var append=[];
  for(var id in jobs){ var jb=jobs[id]; if(!jb.name)continue;
    var st=jb.start?new Date(jb.start):null; var dateS=st?Utilities.formatDate(st,"Asia/Ho_Chi_Minh","yyyy-MM-dd"):""; var timeS=st?Utilities.formatDate(st,"Asia/Ho_Chi_Minh","HH:mm"):"";
    var vals={date:dateS,time:timeS,title:jb.name,client:jb.client||"",venue:jb.loc||"",province:jb.prov||"",type:EV_TYPE_CODE2VI[jb.type]||"Khác",status:EV_ST_CODE2VI[jb.status]||"Đã chốt",drive:jb.drive||"",beat:jb.beat||"",lyrics:jb.lyrics||"",note:jb.note||"",eventId:id,source:"app",syncAt:jb.updatedAt||new Date().toISOString()};
    if(rowById[id]===undefined){ // sự kiện app tạo, Sheet chưa có → thêm dòng
      var rowArr=new Array(S.n).fill(""); for(var k in vals){ if(col[k]!==undefined)rowArr[col[k]]=vals[k]; } append.push(rowArr); nNew++;
    } else { // đã có: nếu app mới hơn syncAt thì cập nhật ô lịch
      var ri=rowById[id]; var syncAt=String((data2[ri]||[])[col.syncAt]||"");
      if(jb.updatedAt && (!syncAt || String(jb.updatedAt)>syncAt)){
        ["date","time","title","client","venue","province","type","status","drive","beat","lyrics","note","syncAt"].forEach(function(k){ if(col[k]!==undefined&&vals[k]!==undefined)sh.getRange(ri+1,col[k]+1).setValue(vals[k]); });
        nPull++;
      }
    }
  }
  if(append.length)sh.getRange(sh.getLastRow()+1,1,append.length,S.n).setValues(append);
  return {pushed:nUp,pulledNew:nNew,pulledUpd:nPull};
}

// ===== CHIỀU CHÍNH: app -> Sheet (tự động mỗi GIỜ) =====
function evListDeletions(){var out={},p="";do{var r=UrlFetchApp.fetch(EV_BASE+"deletions?pageSize=300"+(p?("&pageToken="+p):""),{headers:evHead(),muteHttpExceptions:true});var j=JSON.parse(r.getContentText()||"{}");(j.documents||[]).forEach(function(d){var id=d.name.split("/").pop();var o={id:id};var fs=d.fields||{};for(var k in fs)o[k]=evFromVal(fs[k]);out[id]=o;});p=j.nextPageToken||"";}while(p);return out;}
function evDtk(d,t){return String(d)+"|"+String(t||"").trim().toLowerCase();}
function pullToSheet(){
  var S=evReadSheet(); var sh=S.sh, col=S.col; var data=sh.getDataRange().getValues(); var jobs=evListJobs();
  function gv(row,key){var i=col[key];return(i===undefined)?"":row[i];}
  // ---- Xoá: bỏ dòng sheet ứng với sự kiện đã xoá trên app (tombstone) ----
  var del=evListDeletions(); var delId={},delKey={}; for(var dk in del){delId[dk]=1; if(del[dk].key)delKey[del[dk].key]=1;}
  var nDel=0;
  if(Object.keys(del).length){ var toDel=[]; for(var r=1;r<data.length;r++){var id=String(gv(data[r],"eventId")||"").trim(); var key=evDtk(evYMD(gv(data[r],"date")),gv(data[r],"title")); if((id&&delId[id])||delKey[key])toDel.push(r+1);}
    for(var i=toDel.length-1;i>=0;i--){sh.deleteRow(toDel[i]);nDel++;}
    if(nDel){data=sh.getDataRange().getValues();} }
  var rowById={}; for(var r=1;r<data.length;r++){var id=String(gv(data[r],"eventId")||"").trim(); if(id)rowById[id]=r;}
  var append=[],nNew=0,nUpd=0;
  for(var id in jobs){ var jb=jobs[id]; if(!jb.name)continue; if(delId[id])continue; // đã xoá → bỏ qua
    var st=jb.start?new Date(jb.start):null; var dateS=st?Utilities.formatDate(st,"Asia/Ho_Chi_Minh","yyyy-MM-dd"):""; var timeS=st?Utilities.formatDate(st,"Asia/Ho_Chi_Minh","HH:mm"):"";
    var vals={date:dateS,time:timeS,title:jb.name,client:jb.client||"",venue:jb.loc||"",province:jb.prov||"",type:EV_TYPE_CODE2VI[jb.type]||"Khác",status:EV_ST_CODE2VI[jb.status]||"Đã chốt",drive:jb.drive||"",beat:jb.beat||"",lyrics:jb.lyrics||"",note:jb.note||"",eventId:id,source:"app",syncAt:jb.updatedAt||new Date().toISOString()};
    if(rowById[id]===undefined){ var arr=new Array(S.n).fill(""); for(var k in vals){ if(col[k]!==undefined)arr[col[k]]=vals[k]; } append.push(arr); nNew++; }
    else { var ri=rowById[id]; var syncAt=String((data[ri]||[])[col.syncAt]||""); if(jb.updatedAt&&(!syncAt||String(jb.updatedAt)>syncAt)){ ["date","time","title","client","venue","province","type","status","drive","beat","lyrics","note","syncAt"].forEach(function(k){ if(col[k]!==undefined&&vals[k]!==undefined)sh.getRange(ri+1,col[k]+1).setValue(vals[k]); }); nUpd++; } }
  }
  if(append.length)sh.getRange(sh.getLastRow()+1,1,append.length,S.n).setValues(append);
  return {nNew:nNew,nUpd:nUpd,nDel:nDel};
}
// ===== Sheet -> app (masked) — CHỈ khi sửa Sheet (onEdit) hoặc bấm tay sau khi thêm data từ Claude =====
function evPushRowVals(sh,col,n,row,rIdx,jobs){
  function gv(key){var i=col[key];return(i===undefined)?"":row[i];}
  var title=String(gv("title")||"").trim(); if(!title)return false;
  var date=evYMD(gv("date")); var tm=evTime(gv("time"))||"19:00"; var id=String(gv("eventId")||"").trim()||evMkId(date,title); var start=evIso(date,tm);
  var jb=jobs[id]; var syncAt=String(gv("syncAt")||""); if(jb&&jb.updatedAt&&syncAt&&String(jb.updatedAt)>syncAt)return false; // app mới hơn → không đè
  var job={name:title,type:EV_TYPE_VI2CODE[String(gv("type")||"").trim()]||"khac",status:EV_ST_VI2CODE[String(gv("status")||"").trim()]||"da_chot",start:start,end:evAddH(start,2),loc:String(gv("venue")||""),prov:String(gv("province")||""),client:String(gv("client")||""),drive:String(gv("drive")||""),beat:String(gv("beat")||""),lyrics:String(gv("lyrics")||""),note:String(gv("note")||""),timeline:String(gv("note")||""),updatedAt:new Date().toISOString()};
  evWriteMask(id,job); if(col.eventId!==undefined)sh.getRange(rIdx,col.eventId+1).setValue(id); sh.getRange(rIdx,col.syncAt+1).setValue(job.updatedAt); return true;
}
function evPushRow(r){ var S=evReadSheet(); var sh=S.sh, col=S.col; var row=sh.getRange(r,1,1,S.n).getValues()[0]; evPushRowVals(sh,col,S.n,row,r,evListJobs()); }
function pushAllToApp(){ var S=evReadSheet(); var sh=S.sh, col=S.col; var data=sh.getDataRange().getValues(); var jobs=evListJobs(); var n=0; for(var r=1;r<data.length;r++){ if(evPushRowVals(sh,col,S.n,data[r],r+1,jobs))n++; } return n; }

function evOnEdit(e){ try{ if(!(e&&e.range))return; var sh=e.range.getSheet(); if(sh.getName()!==EV_SHEET)return; var r=e.range.getRow(); if(r<2)return; evPushRow(r); }catch(err){} }
function evInstallTriggers(){
  ScriptApp.getProjectTriggers().forEach(function(t){var h=t.getHandlerFunction(); if(h==="syncEvents"||h==="evOnEdit"||h==="pullToSheet")ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("evOnEdit").forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();   // sửa Sheet → đẩy ngay 1 dòng lên app
  ScriptApp.newTrigger("pullToSheet").timeBased().everyHours(1).create();                           // app → Sheet tự động mỗi giờ
}
function evMenu(){ SpreadsheetApp.getUi().createMenu("Sự kiện")
  .addItem("⟰ Kéo app → Sheet (ngay)","pullToSheet")
  .addItem("⟱ Đẩy Sheet → app (sau khi thêm từ Claude)","pushAllToApp")
  .addItem("⟳ Đồng bộ 2 chiều","syncEvents")
  .addItem("Cài tự động","evInstallTriggers").addToUi(); }
