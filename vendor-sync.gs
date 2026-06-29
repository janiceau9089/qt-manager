/****************************************************************
 * QT Manager — Đồng bộ 2 CHIỀU Danh bạ "Nhà cung cấp"
 * Google Sheet  <->  Firestore (collection vendors)
 * ---------------------------------------------------------------
 * - Sheet đổi  → đẩy sang Firestore NGAY (trigger onEdit cài đặt).
 * - App/Claude ghi Firestore → kéo về Sheet (poll mỗi 5 phút + nút menu).
 * - Chống ghi đè: so sánh cột updatedAt, bên nào mới hơn thắng.
 *
 * ===== CÀI ĐẶT 1 LẦN =====
 * 1. Dán file này vào Apps Script của project QT (cùng nơi firestore-sync.gs).
 * 2. appsscript.json cần ĐỦ các scope sau (dán đè cho chắc):
 *      "https://www.googleapis.com/auth/datastore",
 *      "https://www.googleapis.com/auth/spreadsheets",
 *      "https://www.googleapis.com/auth/script.external_request",  <-- gọi Firestore (UrlFetch)
 *      "https://www.googleapis.com/auth/script.scriptapp"          <-- cài trigger tự động
 * 3. Chạy hàm  installVendorTriggers  1 lần (cấp quyền khi được hỏi).
 * 4. Chạy  setupVendorSheet  để tạo tab "Nhà cung cấp" (nếu chưa có).
 * 5. Xong: sửa trên Sheet là tự lên app; app thêm là tự về Sheet (≤5 phút / bấm "⟳ Sync danh bạ").
 ****************************************************************/

var FS_PROJECT   = "qt-manager-c55f4";
var VENDOR_SHEET = "Nhà cung cấp";
var VCOLS = ["id","name","role","phone","fb","cccd","bankNo","bankName","branch","payCompany","updatedAt"];
// Header tiếng Việt (giống tone 2 tab Sync / Hợp đồng)
var VK2VI = {id:"id", name:"Tên", role:"Vai trò", phone:"SĐT", fb:"Facebook", cccd:"CCCD", bankNo:"Số TK", bankName:"Ngân hàng", branch:"Chi nhánh", payCompany:"Cty nhận TT", updatedAt:"updatedAt"};
// Cột là dãy số dài → luôn lưu/hiển thị dạng VĂN BẢN (giữ số 0 đầu, không 1.23E+11)
var VTEXT = ["phone","cccd","bankNo"];
function viHeaderRow_(){ return VCOLS.map(function(k){ return VK2VI[k]||k; }); }
// Dịch header (VN hoặc key gốc) → key chuẩn, để readSheetVendors không vỡ khi đổi header
function keyForVendorHeader_(h){ h=String(h).trim(); for(var k in VK2VI){ if(VK2VI[k]===h) return k; } if(VCOLS.indexOf(h)>=0) return h; return h; }
// Style header giống styleHead_ ở firestore-sync.gs (tự chứa, không phụ thuộc file kia)
function styleHeadV_(sh,n,nRows){
  var head=sh.getRange(1,1,1,n);
  head.setBackground('#9DC3F0').setFontColor('#10355E').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sh.setFrozenRows(1); sh.setRowHeight(1,38);
  sh.getBandings().forEach(function(b){ b.remove(); });
  var bd=sh.getRange(1,1,Math.max(nRows,2),n).applyRowBanding();
  bd.setHeaderRowColor('#9DC3F0').setFirstRowColor('#FFFFFF').setSecondRowColor('#EAF2FD');
}

function fsBase(){ return "https://firestore.googleapis.com/v1/projects/"+FS_PROJECT+"/databases/(default)/documents"; }
function fsHeaders(){ return { Authorization: "Bearer " + ScriptApp.getOAuthToken() }; }
function fsToVal(v){ if (v===""||v==null) return {nullValue:null}; if (typeof v==="number") return {integerValue:String(v)}; return {stringValue:String(v)}; }
function fsFromVal(f){ if(!f) return ""; if("stringValue" in f) return f.stringValue; if("integerValue" in f) return Number(f.integerValue); if("doubleValue" in f) return f.doubleValue; return ""; }

function readFirestoreVendors(){
  var out = {}; var url = fsBase()+"/vendors?pageSize=400";
  var r = UrlFetchApp.fetch(url, {headers:fsHeaders(), muteHttpExceptions:true});
  var d = JSON.parse(r.getContentText()||"{}");
  (d.documents||[]).forEach(function(doc){
    var id = doc.name.split("/").pop(); var o = {id:id};
    Object.keys(doc.fields||{}).forEach(function(k){ o[k] = fsFromVal(doc.fields[k]); });
    out[id] = o;
  });
  return out;
}
function writeFirestoreVendor(o){
  var fields = {}; VCOLS.forEach(function(k){
    var v = o[k];
    if(VTEXT.indexOf(k)>=0 && v!=null && v!=="") fields[k] = {stringValue:String(v)}; // giữ dãy số dạng chuỗi
    else fields[k] = fsToVal(v);
  });
  var url = fsBase()+"/vendors/"+encodeURIComponent(o.id);
  UrlFetchApp.fetch(url, {method:"patch", contentType:"application/json", headers:fsHeaders(), muteHttpExceptions:true, payload:JSON.stringify({fields:fields})});
}

function getVendorSheet(){
  var ss = SpreadsheetApp.getActive(); var sh = ss.getSheetByName(VENDOR_SHEET);
  if(!sh){ sh = ss.insertSheet(VENDOR_SHEET); sh.getRange(1,1,1,VCOLS.length).setValues([viHeaderRow_()]); sh.setFrozenRows(1); }
  return sh;
}
// Ép các ô dãy số (phone/cccd/bankNo) đang là number → văn bản (giữ trọn dãy số, tránh mất số 0 đầu)
function forceTextDigits_(sh){
  var last = sh.getLastRow(); if(last<2) return;
  VTEXT.forEach(function(k){
    var i = VCOLS.indexOf(k); if(i<0) return;
    var rng = sh.getRange(2,i+1,last-1,1); var vals = rng.getValues(); var chg=false;
    for(var r=0;r<vals.length;r++){ var v=vals[r][0]; if(typeof v==="number"){ vals[r][0]=String(v); chg=true; } }
    rng.setNumberFormat("@");
    if(chg) rng.setValues(vals);
  });
}
// Khôi phục số 0 đầu đã mất (chỉ SĐT & CCCD vì có độ dài cố định). Trả về số ô đã sửa.
function fixLeadingZeros_(sh){
  var last = sh.getLastRow(); if(last<2) return 0;
  var pi=VCOLS.indexOf("phone"), ci=VCOLS.indexOf("cccd"), ui=VCOLS.indexOf("updatedAt");
  var rng = sh.getRange(2,1,last-1,VCOLS.length); var vals = rng.getValues(); var fixed=0;
  for(var r=0;r<vals.length;r++){
    var row=vals[r], changed=false;
    if(pi>=0){ var p=String(row[pi]==null?"":row[pi]).trim();      // SĐT VN luôn có 0 đầu
      if(/^\d+$/.test(p) && (p.length===9||p.length===10) && p[0]!=="0"){ row[pi]="0"+p; changed=true; } }
    if(ci>=0){ var c=String(row[ci]==null?"":row[ci]).trim();      // CCCD luôn 12 số
      if(/^\d+$/.test(c) && c.length>0 && c.length<12){ while(c.length<12) c="0"+c; row[ci]=c; changed=true; } }
    if(changed){ if(ui>=0) row[ui]=Date.now(); fixed++; }           // bump updatedAt để bản Sheet thắng khi sync
  }
  if(fixed) rng.setValues(vals);
  return fixed;
}
// Chạy độc lập từ menu: sửa số 0 đầu rồi đẩy lên app
function fixVendorZeros(){
  var sh=getVendorSheet();
  VTEXT.forEach(function(k){ var i=VCOLS.indexOf(k); if(i>=0) sh.getRange(2,i+1,1000,1).setNumberFormat("@"); });
  forceTextDigits_(sh);
  var nfix=fixLeadingZeros_(sh);
  syncVendors();
  SpreadsheetApp.getUi().alert("Đã khôi phục số 0 đầu cho "+nfix+" ô (SĐT/CCCD). STK độ dài không cố định nên cần nhập lại tay nếu thiếu 0.");
}
function setupVendorSheet(){
  var sh = getVendorSheet(); var n = VCOLS.length;
  // 1) Header tiếng Việt + tone xanh pastel giống 2 tab kia
  sh.getRange(1,1,1,n).setValues([viHeaderRow_()]);
  // 2) Dropdown Vai trò
  var roleCol = VCOLS.indexOf("role")+1;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(["makeup","photo","social","band","dancer","driver"],true).setAllowInvalid(true).build();
  sh.getRange(2,roleCol,1000,1).setDataValidation(rule);
  // 3) Dãy số: định dạng VĂN BẢN cho cả cột + ép dữ liệu cũ thành text
  VTEXT.forEach(function(k){ var i=VCOLS.indexOf(k); if(i>=0) sh.getRange(2,i+1,1000,1).setNumberFormat("@"); });
  forceTextDigits_(sh);
  fixLeadingZeros_(sh); // khôi phục 0 đầu SĐT/CCCD
  // 4) Độ rộng cột
  function w(k,px){ var i=VCOLS.indexOf(k); if(i>=0) sh.setColumnWidth(i+1,px); }
  w("id",90);w("name",170);w("role",100);w("phone",120);w("fb",210);w("cccd",140);w("bankNo",150);w("bankName",130);w("branch",170);w("payCompany",190);
  // 5) Wrap: tên/chi nhánh/cty/fb xuống dòng; cột số thì clip cho gọn
  function wrap(k,on){ var i=VCOLS.indexOf(k); if(i>=0) sh.getRange(2,i+1,1000,1).setWrap(on); }
  ["name","branch","payCompany","fb"].forEach(function(k){ wrap(k,true); });
  ["id","role","phone","cccd","bankNo","bankName"].forEach(function(k){ wrap(k,false); });
  // 6) updatedAt = epoch kỹ thuật (chống đè) → ẩn cột
  sh.hideColumns(VCOLS.indexOf("updatedAt")+1);
  // 7) Đồng bộ dữ liệu rồi áp lại style theo số dòng thực
  sh.setFrozenColumns(2);
  syncVendors();
  styleHeadV_(sh, n, Math.max(sh.getLastRow(),2));
}

function readSheetVendors(){
  var sh = getVendorSheet(); var rng = sh.getDataRange().getValues(); var head = rng[0].map(keyForVendorHeader_); var out = [];
  for(var i=1;i<rng.length;i++){ var row = rng[i]; if(!row[0] && !row[1]) continue;
    var o = {}; head.forEach(function(h,j){ o[h] = row[j]; }); out.push({row:i+1, data:o});
  }
  return out;
}

function syncVendors(){
  var sh = getVendorSheet();
  var fsV = readFirestoreVendors();
  var rows = readSheetVendors();
  var seen = {};
  // --- Sheet -> Firestore ---
  rows.forEach(function(it){
    var o = it.data;
    if(!o.id){ o.id = "v"+Date.now()+Math.floor(Math.random()*1000); sh.getRange(it.row, VCOLS.indexOf("id")+1).setValue(o.id); }
    var su = Number(o.updatedAt)||0;
    var fu = fsV[o.id] ? (Number(fsV[o.id].updatedAt)||0) : -1;
    if(fu === -1 || su >= fu){
      if(!su){ o.updatedAt = Date.now(); sh.getRange(it.row, VCOLS.indexOf("updatedAt")+1).setValue(o.updatedAt); }
      writeFirestoreVendor(o);
    }
    seen[o.id] = true;
  });
  // --- Firestore -> Sheet (bản chỉ có ở FS hoặc mới hơn) ---
  var idCol = {}; rows.forEach(function(it){ idCol[it.data.id] = it.row; });
  var append = [];
  Object.keys(fsV).forEach(function(id){
    var o = fsV[id];
    if(!idCol[id]){ append.push(VCOLS.map(function(k){ return o[k]!=null?o[k]:""; })); }
    else {
      var it = rows.filter(function(x){return x.data.id===id;})[0];
      var su = Number(it.data.updatedAt)||0; var fu = Number(o.updatedAt)||0;
      if(fu > su){ sh.getRange(idCol[id],1,1,VCOLS.length).setValues([VCOLS.map(function(k){return o[k]!=null?o[k]:"";})]); }
    }
  });
  if(append.length) sh.getRange(sh.getLastRow()+1,1,append.length,VCOLS.length).setValues(append);
}

// Trigger: sửa trên Sheet -> đẩy ngay
function onEditVendor(e){
  try{ if(e && e.range && e.range.getSheet().getName()===VENDOR_SHEET){
    var sh = e.range.getSheet(); var r = e.range.getRow(); if(r<2) return;
    sh.getRange(r, VCOLS.indexOf("updatedAt")+1).setValue(Date.now()); // đánh dấu mới
    syncVendors();
  }}catch(err){}
}

function installVendorTriggers(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    var h = t.getHandlerFunction(); if(h==="syncVendors"||h==="onEditVendor") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("onEditVendor").forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger("syncVendors").timeBased().everyMinutes(5).create();
}

// Xoá HẾT danh bạ (Firestore + sheet) — để Trúc/Thi nhập tay từ đầu. Không thể hoàn tác.
function clearVendors(){
  var ui=SpreadsheetApp.getUi();
  if(ui.alert("Xoá HẾT danh bạ?","Xoá toàn bộ vendor trên app (Firestore) + dọn data tab Nhà cung cấp. Không thể hoàn tác.",ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  var fsV=readFirestoreVendors();var n=0;
  Object.keys(fsV).forEach(function(id){ UrlFetchApp.fetch(fsBase()+"/vendors/"+encodeURIComponent(id),{method:"delete",headers:fsHeaders(),muteHttpExceptions:true}); n++; });
  var sh=getVendorSheet();var last=sh.getLastRow();if(last>1)sh.getRange(2,1,last-1,VCOLS.length).clearContent();
  ui.alert("Đã xoá "+n+" vendor trên app + dọn sheet. Danh bạ trống — nhập tay từ app sẽ tự build lại (và sync về sheet).");
}
// (tuỳ chọn) thêm vào menu
function addVendorMenu(){
  SpreadsheetApp.getUi().createMenu("Danh bạ").addItem("⟳ Sync danh bạ ngay","syncVendors").addItem("Định dạng tab Nhà cung cấp","setupVendorSheet").addItem("Sửa số 0 đầu (SĐT/CCCD)","fixVendorZeros").addItem("⚠ Xoá hết danh bạ","clearVendors").addItem("Cài tự động","installVendorTriggers").addToUi();
}
