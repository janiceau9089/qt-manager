/**
 * QT Manager sync  ->  Firestore (qt-manager-c55f4)
 * MÔ HÌNH 2 TAB:
 *   - Sync     = LỊCH + logistics (ngày/giờ/địa điểm/loại + Link Drive/Beat/Lyrics + ghi chú). Do Thi/Vi nhập.
 *   - Hợp đồng = TIỀN/GIẤY TỜ (giá trị, VAT, đợt thanh toán, trạng thái HĐ/hóa đơn). Do kế toán nhập — NGUỒN CHÍNH.
 *   Nối nhau bằng "Mã sự kiện". Khi Push: app GỘP lịch(Sync) + tiền(Hợp đồng).
 *
 * appsscript.json oauthScopes: ["https://www.googleapis.com/auth/datastore","https://www.googleapis.com/auth/spreadsheets"]
 * Chạy bằng tài khoản sở hữu Firebase (janice.au9089).
 */
var PROJECT_ID='qt-manager-c55f4', SHEET_NAME='Sync', CTAB='Hợp đồng';
var BASE='https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents/';

/* ===== Cột Sync (lịch + logistics) ===== */
var COLS=[['date','Ngày diễn'],['time','Giờ'],['title','Tên sự kiện'],['client','Khách hàng'],['venue','Địa điểm'],['province','Tỉnh/Thành'],
['type','Loại'],['status','Trạng thái'],['drive','Link Drive'],['beat','Link Beat'],['lyrics','Link Lyrics'],['pw_notes','Ghi chú'],
['eventId','Mã sự kiện'],['source','Nguồn']];
var ORDER=COLS.map(function(c){return c[0];}); var KEY2VI={}; COLS.forEach(function(c){KEY2VI[c[0]]=c[1];});

/* ===== Cột Hợp đồng (tiền/giấy tờ) ===== */
var CCOLS=[['eventId','Mã sự kiện'],['title','Tên sự kiện (tự)'],['date','Ngày diễn (tự)'],['client','Khách hàng'],
['contractNo','Số HĐ'],['signDate','Ngày ký HĐ'],['contractStatus','Trạng thái HĐ'],
['value','Giá trị HĐ'],['tax','VAT %'],['totalValue','Tổng sau thuế'],
['invoiceNo','Số hóa đơn'],['invoiceStatus','Trạng thái hóa đơn'],
['inst1_amount','Đợt 1 · tiền'],['inst1_date','Đợt 1 · hạn'],['inst1_status','Đợt 1 · trạng thái'],
['inst2_amount','Đợt 2 · tiền'],['inst2_date','Đợt 2 · hạn'],['inst2_status','Đợt 2 · trạng thái'],
['driveLink','Link file HĐ'],['note','Ghi chú']];
var CORDER=CCOLS.map(function(c){return c[0];}); var CK2VI={}; CCOLS.forEach(function(c){CK2VI[c[0]]=c[1];});
var CAUTO=['title','date']; // cột tự điền bằng công thức từ Sync
var CMONEY=['value','totalValue','inst1_amount','inst2_amount'];

/* options dropdown */
var OPT_TYPE=['Ticket','Public','Event','Gameshow','Podcast','Quay social','Thu âm','Phỏng vấn/Họp','Chụp hình','Livestream','Cá nhân','Khác'];
var OPT_STATUS=['Đã chốt','Đang báo giá','Đang đàm phán','Đã ký HĐ','Hoàn thành','Đã hủy'];
var OPT_CT=['Chưa có','Đang soạn','Đã gửi','Đã ký','Đã lưu final'];
var OPT_INV=['Chưa xuất','Đã xuất','Đã gửi','Đã thanh toán'];
var OPT_PAY=['Chưa đến hạn','Đến hạn','Quá hạn','Đã thanh toán'];
var SYNC_DD={type:OPT_TYPE,status:OPT_STATUS};
var C_DD={contractStatus:OPT_CT,invoiceStatus:OPT_INV,inst1_status:OPT_PAY,inst2_status:OPT_PAY};
var MONEY_FMT='#,##0" ₫"';

/* alias header -> key (đọc cũ/mới) */
var ALIAS={date:['date','ngày diễn'],time:['time','giờ'],title:['title','tên sự kiện'],client:['client','khách hàng'],venue:['venue','địa điểm'],province:['province','tỉnh/thành'],type:['type','loại'],status:['status','trạng thái'],drive:['drive','link drive'],beat:['beat','link beat'],lyrics:['lyrics','link lyrics'],value:['value','giá trị hđ','giá trị (triệu)'],tax:['tax','vat %'],totalValue:['totalvalue','tổng sau thuế','tổng sau thuế (triệu)'],instCount:['instcount','số đợt'],finStatus:['finstatus','tình trạng thanh toán'],inst1_paid:['inst1_paid','đợt 1 · đã trả?'],inst1_pct:['inst1_pct','đợt 1 · %'],inst1_amount:['inst1_amount','đợt 1 · tiền'],inst1_date:['inst1_date','đợt 1 · ngày','đợt 1 · hạn'],inst1_note:['inst1_note','đợt 1 · ghi chú'],inst2_paid:['inst2_paid','đợt 2 · đã trả?'],inst2_pct:['inst2_pct','đợt 2 · %'],inst2_amount:['inst2_amount','đợt 2 · tiền'],inst2_date:['inst2_date','đợt 2 · ngày','đợt 2 · hạn'],inst2_note:['inst2_note','đợt 2 · ghi chú'],pw_notes:['pw_notes','ghi chú'],eventId:['eventid','mã sự kiện'],source:['source','nguồn']};
var H2K={}; for(var k in ALIAS) ALIAS[k].forEach(function(s){H2K[s]=k;});
function keyForHeader_(h){return H2K[String(h).trim().toLowerCase()]||null;}

function onOpen(){SpreadsheetApp.getUi().createMenu('Firestore Sync')
 .addItem('⟳ Đồng bộ lịch Google Calendar → Sheet + App','importFromCalendar')
 .addItem('① Định dạng tab Sync (+ cấp Mã sự kiện)','setupSheet')
 .addItem('③ Tạo / Cập nhật tab Hợp đồng','setupContractsTab')
 .addItem('② Đẩy lên app (gộp Sync + Hợp đồng)','pushToApp')
 .addItem('②b Đẩy CHỈ tiền (pays) — không đụng job','pushPaysOnly')
 .addItem('↕ Sắp xếp lại theo ngày','sortSheet')
 .addSeparator()
 .addItem('⏰ Bật tự đồng bộ lịch mỗi 30 phút','enableAutoSync')
 .addItem('⏰ Tắt tự đồng bộ','disableAutoSync')
 .addItem('🧹 Gộp sự kiện trùng (Ngày + Tên)','dedupEvents')
 .addItem('⚠ Xoá sample data (demo + pays/exps/docs/tasks)','clearSampleData')
 .addItem('⚠ Xoá hết jobs/pays trên app (reset)','resetApp').addToUi();}

/* ===== tiện ích ===== */
function colL_(n){var s='';while(n>0){var m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=(n-m-1)/26;}return s;}
function toYMD_(v){if(v instanceof Date)return Utilities.formatDate(v,'Asia/Ho_Chi_Minh','yyyy-MM-dd');return String(v||'').slice(0,10);}
function toMin_(v){if(v instanceof Date)return v.getHours()*60+v.getMinutes();var m=String(v||'').match(/(\d{1,2}):(\d{2})/);return m?(+m[1])*60+(+m[2]):0;}
function pad_(n,l){n=String(n);while(n.length<l)n='0'+n;return n;}
function sortKey_(d,t){return toYMD_(d)+'T'+pad_(toMin_(t),4);}
function slug_(s){return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,28);}
function mkId_(date,title){return 'qt_'+String(date).replace(/-/g,'')+'_'+slug_(title);}

/* ===== Đồng bộ thẳng từ Google Calendar -> tab Sync (khỏi tải/Import CSV) ===== */
var CAL_ID='quocthienofficial@gmail.com';
function cExtractTime_(s){var m=s.match(/\b(\d{1,2})\s*[:h]\s*(\d{2})\b/);if(m){var h=+m[1],mi=+m[2];if(h<24&&mi<60)return pad_(h,2)+':'+pad_(mi,2);}m=s.match(/\b(\d{1,2})\s*h\b/i);if(m){var h=+m[1];if(h<24)return pad_(h,2)+':00';}return '';}
function cFee_(desc,name){var m=desc.match(/(\d{2,4})\s*[HhTt](?![0-9A-Za-zÀ-ỹ])/);if(m)return +m[1];var re=/\b(\d{3})\b/g,mm;while((mm=re.exec(name))){var idx=mm.index;var after=name.slice(idx+3,idx+4);if(/[hH:]/.test(after))continue;return +mm[1];}return 0;}
function cForeign_(s){return /houston|portland|virginia|connecticut|adelaide|san jose|skynote|sydney|melbourne|perth|\boc\b|\bsj\b/i.test(s);}
function cPersonal_(s){return /meeting|lăn tay|lan tay|\bvisa\b|đám cưới|dam cuoi|wedding|ko nhận|khong nhan/.test(s.toLowerCase());}
function cType_(name){var t=name.toLowerCase();if(/gđ haha|gd haha|gia đình haha|gia dinh haha/.test(t))return 'Gameshow';if(cPersonal_(t))return 'Cá nhân';if(/\bmsd\b/.test(t))return 'Event';if(cForeign_(t))return 'Ticket';if(/\(va\)/.test(t))return 'Ticket';if(/quay|ghi hình|ghi hinh|content|\bmv\b|vtv/.test(t))return 'Quay social';if(/thu âm|thu am|record/.test(t))return 'Thu âm';if(/podcast/.test(t))return 'Podcast';if(/livestream|live stream/.test(t))return 'Livestream';if(/chụp|chup|photo|shoot/.test(t))return 'Chụp hình';if(/gameshow|game show|2 ngày 1 đêm/.test(t))return 'Gameshow';if(/gala|yep|award|tiệc|tiec|dinner|động thổ|dong tho|khai trương|khai truong|\bevent\b|vietinbank|vnpay|chicilon|tập đoàn|tap doan|y tế|y te|tân hoàng minh|tan hoang minh|private|\bmsb\b|pepsi|\bocb\b|petrosetco|\bfpt\b|\btcs\b/.test(t))return 'Event';if(/phố đi bộ|pho di bo|nguyễn huệ|nguyen hue|quảng trường|quang truong|khai mạc|khai mac|lễ hội|le hoi|giao thừa|giao thua|countdown|làng sen|lang sen/.test(t))return 'Public';if(/tập|tap |rehearsal|chạy sk|chay sk|sound ?check|concert|liveshow|show|mây|may |phòng trà|phong tra|nhà hát|nha hat|\bnh\b|\bpt\b|đêm nhạc|dem nhac|fantasy|dốc mộng|doc mong|trạm yêu|tram yeu|\bvé\b|\bve\b|melody|sky|lasong|musique|salon|nhạc|nhac|hát|hat|xuân|xuan|tết|tet|gao/.test(t))return 'Ticket';return 'Khác';}
function cProv_(s,name){if(cForeign_(name))return 'Nước ngoài';s=(s||'').toLowerCase();if(/hà nội|ha noi|hoàn kiếm|hoan kiem|cầu giấy|cau giay|đống đa|dong da|mỹ đình|my dinh|hào nam|ba đình/.test(s))return 'Hà Nội';if(/hồ chí minh|ho chi minh|hcm|thủ đức|thu duc|bến thành|ben thanh|nguyễn huệ|nguyen hue|tân bình|tan binh|gem|secc|quận|q\.?\d/.test(s))return 'TP.HCM';if(/đà lạt|da lat|dalat|lâm đồng/.test(s))return 'Lâm Đồng';if(/hải phòng|hai phong/.test(s))return 'Hải Phòng';if(/đà nẵng|da nang/.test(s))return 'Đà Nẵng';if(/hội an|hoi an/.test(s))return 'Quảng Nam';if(/hạ long|ha long/.test(s))return 'Quảng Ninh';if(/huế|hue/.test(s))return 'Huế';if(/nghệ an|nghe an|làng sen|lang sen|kim liên|vinh/.test(s))return 'Nghệ An';if(/thanh hoá|thanh hoa/.test(s))return 'Thanh Hoá';return '';}
function cClean_(s){var t=s.replace(/^\s*done\s+/i,'');t=t.replace(/^\s*c[oọ]c\s*(l[aâ]n\s*1|l\.?\s*1|1)\b\s*[:\-–]?\s*/i,'');t=t.replace(/^\s*\d{1,2}\s*h\s*\d{0,2}\s*/i,'');t=t.replace(/^\s*\d{1,3}\s+(?=[A-Za-zÀ-ỹ&])/,'');t=t.replace(/[-–·]?\s*\b\d{1,2}\s*[h:]\s*\d{2}\b/gi,' ');t=t.replace(/[-–·]?\s*\b\d{1,2}\s*h\b/gi,' ');t=t.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g,' ');t=t.replace(/\s*(done|xong)\s*$/i,'');t=t.replace(/[-–·]?\s*\b\d{2,4}\b\s*$/,'');t=t.replace(/\s*[&/]\s*$/,'');t=t.replace(/\s*[-–·:>]+\s*$/,'').replace(/^\s*[-–·:]\s*/,'');t=t.replace(/\s{2,}/g,' ').trim();if(!t)t=s.replace(/^\s*done\s+/i,'').trim();return t;}
function cSpell_(t){if(/^[a-zà-ỹ]/.test(t))t=t.charAt(0).toUpperCase()+t.slice(1);return t;}

function readDeletions_(){var out={};var p='';do{var r=UrlFetchApp.fetch(BASE+'deletions?pageSize=300'+(p?('&pageToken='+p):''),{headers:{Authorization:'Bearer '+tok_()},muteHttpExceptions:true});var j=JSON.parse(r.getContentText()||'{}');(j.documents||[]).forEach(function(d){var id=d.name.split('/').pop();var f=d.fields||{};out[id]={id:id,key:(f.key&&f.key.stringValue)||''};});p=j.nextPageToken||'';}while(p);return out;}
function importFromCalendar(silent){
 // silent = chạy từ trigger (không có UI). Trigger truyền event object (truthy) → tự im lặng.
 function note_(m){ if(silent)return; try{ SpreadsheetApp.getUi().alert(m); }catch(e){} }
 var ss=SpreadsheetApp.getActive();var sh=ss.getSheetByName(SHEET_NAME)||ss.insertSheet(SHEET_NAME);
 var cal=CalendarApp.getCalendarById(CAL_ID);
 if(!cal){ try{ cal=CalendarApp.subscribeToCalendar(CAL_ID); }catch(e){} }   // tự thêm lịch đã share vào danh sách
 if(!cal){note_('Không truy cập được lịch '+CAL_ID+'.\n1) Đã share lịch cho tài khoản chạy script chưa?\n2) appsscript.json cần scope https://www.googleapis.com/auth/calendar (đầy đủ) rồi chạy lại + Allow.');return;}
 var from=new Date(2026,0,1);var to=new Date();to.setFullYear(to.getFullYear()+2);
 var evs=cal.getEvents(from,to);
 var data=sh.getDataRange().getValues();var header=(data[0]||[]).map(function(x){return String(x).trim();});var colKey={};header.forEach(function(h,i){var k=keyForHeader_(h);if(k)colKey[k]=i;});
 var rowsArr=[],seenDT={},byDateRows={};
 function dtk_(d,t){return String(d)+'|'+String(t||'').trim().toLowerCase();} // khoá gộp theo Ngày + Tên
 function regRow_(o){(byDateRows[o.date]=byDateRows[o.date]||[]).push({o:o,tok:_dTok(o.title)});}
 function fuzzyRow_(date,tok){var a=byDateRows[date]||[];for(var z=0;z<a.length;z++){if(_dSim(a[z].tok,tok))return a[z].o;}return null;}
 var dels=readDeletions_();var delId={},delKey={};for(var dd in dels){delId[dd]=1;if(dels[dd].key)delKey[dels[dd].key]=1;} // sự kiện đã xoá trên app
 for(var r=1;r<data.length;r++){var o={};ORDER.forEach(function(k){o[k]=(colKey[k]!==undefined)?data[r][colKey[k]]:'';});if(!o.title&&!o.date)continue;o.date=toYMD_(o.date);
   var k0=dtk_(o.date,o.title);
   if((o.eventId&&delId[o.eventId])||delKey[k0])continue; // đã xoá → bỏ khỏi sheet, không nạp lại
   var fz=fuzzyRow_(o.date,_dTok(o.title));
   if(fz){if((!fz.eventId||fz.source==='cal')&&o.eventId&&o.source!=='cal'){fz.eventId=o.eventId;fz.source=o.source;}continue;} // trùng (mờ) -> gộp, ưu tiên Mã app
   rowsArr.push(o);seenDT[k0]=o;regRow_(o);}
 var added=0,updated=0;
 evs.forEach(function(ev){var rawT=(ev.getTitle()||'').replace(/^\s*done\s+/i,'').trim();if(!rawT)return;
  var desc=ev.getDescription()||'';var loc=ev.getLocation()||'';var st=ev.getStartTime();
  var dateStr=Utilities.formatDate(st,'Asia/Ho_Chi_Minh','yyyy-MM-dd');var typeVI=cType_(rawT);var foreign=cForeign_(rawT);
  var time=foreign?'':(cExtractTime_(rawT)||(ev.isAllDayEvent()?'':Utilities.formatDate(st,'Asia/Ho_Chi_Minh','HH:mm')));
  var title=cSpell_(cClean_(rawT));var eid=mkId_(dateStr,title);var fee=cFee_(desc,rawT);
  var nb=[];if(title!==rawT)nb.push('[Tên gốc: '+rawT+']');if(fee&&typeVI!=='Cá nhân')nb.push('[Gợi ý fee: '+fee+'tr]');if(desc)nb.push(desc.replace(/\n+/g,' / '));var note=nb.join(' ');
  var k1=dtk_(dateStr,title);var tok1=_dTok(title);
  if(delKey[k1]||delId[eid])return; // sự kiện đã xoá trên app → không thêm lại từ Calendar
  var ex=fuzzyRow_(dateStr,tok1); // khớp mờ với dòng sẵn có (tránh đôi do tên viết tắt)
  if(ex){ex.date=dateStr;ex.time=time||ex.time;if(loc)ex.venue=loc;ex.province=cProv_(loc,rawT)||ex.province;ex.type=typeVI;if(!ex.pw_notes)ex.pw_notes=note;if(!ex.eventId)ex.eventId=eid;updated++;}
  else{var nr={date:dateStr,time:time,title:title,client:'',venue:loc,province:cProv_(loc,rawT),type:typeVI,status:'Đã chốt',drive:'',beat:'',lyrics:'',pw_notes:note,eventId:eid,source:'cal'};rowsArr.push(nr);seenDT[k1]=nr;regRow_(nr);added++;}
 });
 rowsArr.sort(function(a,b){var ka=sortKey_(a.date,a.time),kb=sortKey_(b.date,b.time);return ka<kb?1:(ka>kb?-1:0);});
 var out=[ORDER.map(function(k){return KEY2VI[k];})];rowsArr.forEach(function(o){out.push(ORDER.map(function(k){return (o[k]===undefined?'':o[k]);}));});
 sh.clear();sh.getRange(1,1,out.length,ORDER.length).setValues(out);sh.setFrozenColumns(2);
 styleHead_(sh,ORDER.length,out.length);
 for(var key in SYNC_DD){var i=ORDER.indexOf(key);if(i>=0&&out.length>1)setDD_(sh,i,SYNC_DD[key],2,out.length-1);}
 // Đẩy luôn lên app (masked qua event-sync: tạo sự kiện mới, KHÔNG đè band/makeup/HĐ đã có)
 var pushed=0,pushErr='';
 try{ if(typeof pushAllToApp==='function') pushed=pushAllToApp(); else pushErr='Chưa cài event-sync.gs (thiếu pushAllToApp).'; }
 catch(e){ pushErr=String(e); }
 note_('Đồng bộ Google Calendar xong:\n• Sheet: thêm '+added+', cập nhật '+updated+' sự kiện (giữ Link/Ghi chú).\n• App: đẩy '+pushed+' sự kiện'+(pushErr?(' — ⚠ '+pushErr):' ✓ (không đè band/makeup/HĐ).'));
}
function enableAutoSync(){ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='importFromCalendar')ScriptApp.deleteTrigger(t);});ScriptApp.newTrigger('importFromCalendar').timeBased().everyMinutes(30).create();SpreadsheetApp.getUi().alert('Đã bật: tự đồng bộ lịch Google Calendar → Sheet + App mỗi 30 phút.');}
function disableAutoSync(){var n=0;ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='importFromCalendar'){ScriptApp.deleteTrigger(t);n++;}});SpreadsheetApp.getUi().alert('Đã tắt tự đồng bộ ('+n+' lịch).');}

function styleHead_(sh,n,nRows){var head=sh.getRange(1,1,1,n);head.setBackground('#9DC3F0').setFontColor('#10355E').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);sh.setFrozenRows(1);sh.setRowHeight(1,38);sh.getBandings().forEach(function(b){b.remove();});var bd=sh.getRange(1,1,Math.max(nRows,2),n).applyRowBanding();bd.setHeaderRowColor('#9DC3F0').setFirstRowColor('#FFFFFF').setSecondRowColor('#EAF2FD');}
function setDD_(sh,colIdx,opts,fromRow,nRows){if(nRows<1)return;var rule=SpreadsheetApp.newDataValidation().requireValueInList(opts,true).setAllowInvalid(true).build();sh.getRange(fromRow,colIdx+1,nRows,1).setDataValidation(rule);}

/* ===== ① Sync ===== */
function setupSheet(){
 var ss=SpreadsheetApp.getActive();var sh=ss.getSheetByName(SHEET_NAME)||ss.getActiveSheet();if(sh.getName()!==SHEET_NAME)sh.setName(SHEET_NAME);
 var data=sh.getDataRange().getValues();var header=(data[0]||[]).map(function(x){return String(x).trim();});
 var colKey={};header.forEach(function(h,i){var key=keyForHeader_(h);if(key)colKey[key]=i;});
 var rows=[];
 for(var r=1;r<data.length;r++){var src=data[r],o={};ORDER.forEach(function(key){o[key]=(colKey[key]!==undefined)?src[colKey[key]]:'';});if(!o.title&&!o.date)continue;
   if(!o.eventId)o.eventId=mkId_(toYMD_(o.date),o.title); // cấp Mã sự kiện
   rows.push(o);}
 rows.sort(function(a,b){var ka=sortKey_(a.date,a.time),kb=sortKey_(b.date,b.time);return ka<kb?1:(ka>kb?-1:0);});
 var out=[ORDER.map(function(key){return KEY2VI[key];})];rows.forEach(function(o){out.push(ORDER.map(function(key){return o[key];}));});
 sh.clear();sh.getRange(1,1,out.length,ORDER.length).setValues(out);sh.setFrozenColumns(2);
 styleHead_(sh,ORDER.length,out.length);
 for(var key in SYNC_DD){var i=ORDER.indexOf(key);if(i>=0&&out.length>1)setDD_(sh,i,SYNC_DD[key],2,out.length-1);}
 function w(key,px){var i=ORDER.indexOf(key);if(i>=0)sh.setColumnWidth(i+1,px);}
 w('date',100);w('time',70);w('title',240);w('venue',260);w('client',150);w('drive',150);w('beat',150);w('lyrics',150);w('pw_notes',320);w('eventId',230);
 SpreadsheetApp.getUi().alert('Tab Sync: lịch + Link Drive/Beat/Lyrics, đã cấp Mã sự kiện, dropdown Loại/Trạng thái, tone xanh pastel ✓');
}

/* ===== ③ Hợp đồng (nối với Sync) ===== */
function setupContractsTab(){
 var ss=SpreadsheetApp.getActive();var sh=ss.getSheetByName(SHEET_NAME);
 if(!sh){SpreadsheetApp.getUi().alert('Chưa có tab Sync. Chạy ① trước.');return;}
 // đảm bảo Sync có Mã sự kiện
 setupSheetIdsOnly_(sh);
 var sh1=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(function(x){return String(x).trim();});
 var idCol=-1,titleCol=-1,dateCol=-1; sh1.forEach(function(h,i){var k=keyForHeader_(h);if(k==='eventId')idCol=i;if(k==='title')titleCol=i;if(k==='date')dateCol=i;});
 if(idCol<0){SpreadsheetApp.getUi().alert('Sync thiếu cột Mã sự kiện. Chạy ① trước.');return;}
 var SID=colL_(idCol+1),STITLE=colL_(titleCol+1),SDATE=colL_(dateCol+1);
 var ct=ss.getSheetByName(CTAB)||ss.insertSheet(CTAB);
 var n=CORDER.length;
 var cur=ct.getDataRange().getValues();var dataRows=(cur.length>1&&cur[0].join('')!=='')?(cur.length-1):0;
 ct.getRange(1,1,1,n).setValues([CORDER.map(function(k){return CK2VI[k];})]); // ghi header (giữ data đã import bên dưới)
 var ROWS=Math.max(dataRows,1)+200; // chừa chỗ nhập thêm
 // công thức tự điền Tên / Ngày từ Sync theo Mã sự kiện (cột A) — kế toán khỏi gõ tên
 var ci_title=CORDER.indexOf('title'),ci_date=CORDER.indexOf('date');var fT=[],fD=[];
 for(var rr=2;rr<2+ROWS;rr++){fT.push(['=IFERROR(INDEX(Sync!'+STITLE+':'+STITLE+',MATCH($A'+rr+',Sync!'+SID+':'+SID+',0)),"")']);fD.push(['=IFERROR(TEXT(INDEX(Sync!'+SDATE+':'+SDATE+',MATCH($A'+rr+',Sync!'+SID+':'+SID+',0)),"yyyy-mm-dd"),"")']);}
 ct.getRange(2,ci_title+1,ROWS,1).setFormulas(fT);
 ct.getRange(2,ci_date+1,ROWS,1).setFormulas(fD);
 ct.setFrozenRows(1);ct.setFrozenColumns(2);
 styleHead_(ct,n,2+ROWS);
 // dropdown Mã sự kiện = danh sách eventId bên Sync; + dropdown trạng thái
 var idRange=sh.getRange(SID+'2:'+SID);
 var idRule=SpreadsheetApp.newDataValidation().requireValueInRange(idRange,true).setAllowInvalid(true).build();
 ct.getRange(2,1,ROWS,1).setDataValidation(idRule);
 for(var key in C_DD){var i=CORDER.indexOf(key);if(i>=0)setDD_(ct,i,C_DD[key],2,ROWS);}
 CMONEY.forEach(function(k){var i=CORDER.indexOf(k);if(i>=0)ct.getRange(2,i+1,ROWS,1).setNumberFormat(MONEY_FMT);});
 // độ rộng
 function w(key,px){var i=CORDER.indexOf(key);if(i>=0)ct.setColumnWidth(i+1,px);}
 w('eventId',230);w('title',240);w('client',160);w('contractNo',150);w('driveLink',200);w('note',280);w('value',150);w('totalValue',150);w('inst1_amount',140);w('inst2_amount',140);
 SpreadsheetApp.getUi().alert('Tab "Hợp đồng" đã định dạng: chọn Mã sự kiện ở cột A (dropdown) → Tên/Ngày tự hiện. Kế toán nhập tiền tại đây.');
}
function setupSheetIdsOnly_(sh){var d=sh.getDataRange().getValues();var h=d[0].map(function(x){return String(x).trim();});var ic=-1,tc=-1,dc=-1;h.forEach(function(x,i){var k=keyForHeader_(x);if(k==='eventId')ic=i;if(k==='title')tc=i;if(k==='date')dc=i;});if(ic<0)return;var chg=false;for(var r=1;r<d.length;r++){if(!d[r][ic]&&(d[r][tc]||d[r][dc])){sh.getRange(r+1,ic+1).setValue(mkId_(toYMD_(d[r][dc]),d[r][tc]));chg=true;}}return chg;}

/* tự sắp xếp khi sửa ngày/giờ ở Sync */
function onEdit(e){try{var sh=e.range.getSheet();if(sh.getName()!==SHEET_NAME)return;if(e.range.getRow()===1)return;var header=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(function(x){return String(x).trim();});var key=keyForHeader_(header[e.range.getColumn()-1]);if(key==='date'||key==='time')sortSheet();}catch(_){}}
function sortSheet(){var sh=SpreadsheetApp.getActive().getSheetByName(SHEET_NAME)||SpreadsheetApp.getActiveSheet();var data=sh.getDataRange().getValues();if(data.length<3)return;var header=data[0].map(function(x){return String(x).trim();});var di=-1,ti=-1;header.forEach(function(h,i){var k=keyForHeader_(h);if(k==='date')di=i;if(k==='time')ti=i;});if(di<0)return;var body=data.slice(1).filter(function(r){return r.join('')!=='';});body.sort(function(a,b){var ka=sortKey_(a[di],ti>=0?a[ti]:''),kb=sortKey_(b[di],ti>=0?b[ti]:'');return ka<kb?1:(ka>kb?-1:0);});sh.getRange(2,1,body.length,data[0].length).setValues(body);}

/* ===== Firestore ===== */
function tok_(){return ScriptApp.getOAuthToken();}
function fval_(v){if(v===null||v===undefined||v==='')return{nullValue:null};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(Array.isArray(v))return{arrayValue:{values:v.map(fval_)}};return{stringValue:String(v)};}
function toFields_(o){var f={};for(var k in o)f[k]=fval_(o[k]);return{fields:f};}
function write_(coll,id,o){var res=UrlFetchApp.fetch(BASE+coll+'/'+encodeURIComponent(id),{method:'patch',contentType:'application/json',headers:{Authorization:'Bearer '+tok_()},payload:JSON.stringify(toFields_(o)),muteHttpExceptions:true});if(res.getResponseCode()>=300)throw new Error(coll+'/'+id+': '+res.getContentText());}
function listIds_(coll){var ids=[],p='';do{var r=UrlFetchApp.fetch(BASE+coll+'?pageSize=300'+(p?('&pageToken='+p):''),{headers:{Authorization:'Bearer '+tok_()},muteHttpExceptions:true});var j=JSON.parse(r.getContentText()||'{}');(j.documents||[]).forEach(function(d){ids.push(d.name.split('/').pop());});p=j.nextPageToken||'';}while(p);return ids;}
function del_(coll,id){UrlFetchApp.fetch(BASE+coll+'/'+encodeURIComponent(id),{method:'delete',headers:{Authorization:'Bearer '+tok_()},muteHttpExceptions:true});}

var TYPE_MAP={'Ticket':'ticket','Public':'public','Event':'event_checkin','Gameshow':'gameshow','Podcast':'podcast','Quay social':'quay_social','Thu âm':'thu_am','Phỏng vấn/Họp':'phong_van','Chụp hình':'chup_hinh','Livestream':'livestream','Cá nhân':'canhan','Khác':'khac'};
var STATUS_MAP={'Đã chốt':'da_chot','Đang báo giá':'bao_gia','Đang đàm phán':'dam_phan','Đã ký HĐ':'da_ky_hd','Hoàn thành':'hoan_thanh','Đã hủy':'da_huy','confirmed':'da_chot'};
var PAYST_MAP={'Đã thanh toán':'da_thanh_toan','Quá hạn':'qua_han','Đến hạn':'den_han','Chưa đến hạn':'chua_den_han'};
function isoStart_(d,t){t=t||'19:00';return d+'T'+(String(t).length>=4?String(t).slice(0,5):'19:00')+':00+07:00';}
function addHours_(iso,h){var d=new Date(iso);d.setHours(d.getHours()+h);return d.toISOString();}

function readContracts_(){ // map eventId -> finance từ tab Hợp đồng
 var ss=SpreadsheetApp.getActive();var ct=ss.getSheetByName(CTAB);var m={};if(!ct)return m;
 var d=ct.getDataRange().getValues();if(d.length<2)return m;var h=d[0].map(function(x){return String(x).trim();});var ci={};h.forEach(function(x,i){
   var key=null; for(var k in CK2VI){ if(CK2VI[k].toLowerCase()===x.toLowerCase())key=k; } if(key)ci[key]=i;});
 function g(row,key){var i=ci[key];return i===undefined?'':row[i];}
 for(var r=1;r<d.length;r++){var eid=String(g(d[r],'eventId')||'').trim();if(!eid)continue;
   m[eid]={value:Number(g(d[r],'value')||0),tax:Number(g(d[r],'tax')||0),totalValue:Number(g(d[r],'totalValue')||0),
    inst:[{amt:Number(g(d[r],'inst1_amount')||0),date:toYMD_(g(d[r],'inst1_date')),st:String(g(d[r],'inst1_status')||'')},
          {amt:Number(g(d[r],'inst2_amount')||0),date:toYMD_(g(d[r],'inst2_date')),st:String(g(d[r],'inst2_status')||'')}]};}
 return m;}

function pushToApp(){
 var sh=SpreadsheetApp.getActive().getSheetByName(SHEET_NAME)||SpreadsheetApp.getActiveSheet();
 setupSheetIdsOnly_(sh);
 var data=sh.getDataRange().getValues();var header=data[0].map(function(x){return String(x).trim();});var col={};header.forEach(function(h,i){var k=keyForHeader_(h);if(k)col[k]=i;});
 function gv(row,key){var i=col[key];return(i===undefined)?'':row[i];}
 if(col['title']===undefined)throw new Error('Chưa thấy cột Tên sự kiện. Chạy ① trước.');
 var HD=readContracts_();
 var nJobs=0,nPays=0;
 for(var r=1;r<data.length;r++){var row=data[r];var title=gv(row,'title');if(!title)continue;
  var date=toYMD_(gv(row,'date'));var tm=String(gv(row,'time')||'');var tmm=tm.match(/(\d{1,2}):(\d{2})/);var start=isoStart_(date,tmm?(pad_(tmm[1],2)+':'+tmm[2]):'19:00');
  var eventId=gv(row,'eventId')?String(gv(row,'eventId')):mkId_(date,title);
  var fin=HD[eventId]||null;
  var net=fin?fin.value:0;
  var job={id:eventId,sourceApp:'qt-artist-manager',entityType:'job',artistId:'artist_quocthien',name:title,
   type:TYPE_MAP[String(gv(row,'type')||'').trim()]||'khac',status:STATUS_MAP[String(gv(row,'status')||'').trim()]||'da_chot',
   start:start,end:addHours_(start,2),loc:String(gv(row,'venue')||''),prov:String(gv(row,'province')||''),client:String(gv(row,'client')||''),
   net:net,vat:fin?fin.tax:0,timeline:String(gv(row,'pw_notes')||''),note:String(gv(row,'pw_notes')||''),
   drive:String(gv(row,'drive')||''),beat:String(gv(row,'beat')||''),lyrics:String(gv(row,'lyrics')||''),
   setlist:'',contact:'',phone:'',call:null,follow:false,tags:['from-sheet'],updatedAt:new Date().toISOString()};
  write_('jobs',eventId,job);nJobs++;
  if(fin){ for(var k=0;k<fin.inst.length;k++){var it=fin.inst[k];if(!it.amt)continue;
    var due=it.date?(it.date+'T00:00:00+07:00'):(k===0?start:addHours_(start,24*7));
    write_('pays',eventId+'_'+(k+1),{id:eventId+'_'+(k+1),job:eventId,label:'Đợt '+(k+1),amt:it.amt,pct:fin.totalValue?Math.round(it.amt/fin.totalValue*100):0,due:due,st:PAYST_MAP[it.st.trim()]||'chua_den_han',paid:(it.st.trim()==='Đã thanh toán')?new Date().toISOString():null,sourceApp:'qt-artist-manager',entityType:'payment',jobId:eventId,updatedAt:new Date().toISOString()});nPays++;}}
  if(col['eventId']!==undefined)sh.getRange(r+1,col['eventId']+1).setValue(eventId);
  if(col['source']!==undefined)sh.getRange(r+1,col['source']+1).setValue('synced');
 }
 sortSheet();
 SpreadsheetApp.getUi().alert('Đã đẩy lên app: '+nJobs+' job, '+nPays+' đợt (tiền lấy từ tab Hợp đồng).');
}
/* ②b — Đẩy CHỈ tiền (pays) từ tab Hợp đồng, KHÔNG ghi/đụng job (tránh mất field giàu) */
function paysStartMap_(){var m={};var sh=SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);if(!sh)return m;var d=sh.getDataRange().getValues();if(d.length<2)return m;var h=d[0].map(function(x){return String(x).trim();});var col={};h.forEach(function(x,i){var k=keyForHeader_(x);if(k)col[k]=i;});if(col['eventId']===undefined)return m;
 for(var r=1;r<d.length;r++){var eid=String(d[r][col['eventId']]||'').trim();if(!eid)continue;var date=toYMD_(d[r][col['date']]);var tm=String(col['time']!==undefined?d[r][col['time']]:'');var tmm=tm.match(/(\d{1,2}):(\d{2})/);m[eid]=isoStart_(date,tmm?(pad_(tmm[1],2)+':'+tmm[2]):'19:00');}return m;}
function pushPaysOnly(){
 var HD=readContracts_();var startById=paysStartMap_();var n=0, ev=0;
 Object.keys(HD).forEach(function(eventId){var fin=HD[eventId];if(!fin)return;ev++;
  for(var k=0;k<fin.inst.length;k++){var it=fin.inst[k];if(!it.amt)continue;
   var due=it.date?(it.date+'T00:00:00+07:00'):(startById[eventId]||isoStart_(toYMD_(new Date()),'19:00'));
   var stt=String(it.st||'').trim();
   write_('pays',eventId+'_'+(k+1),{id:eventId+'_'+(k+1),job:eventId,label:'Đợt '+(k+1),amt:it.amt,pct:fin.totalValue?Math.round(it.amt/fin.totalValue*100):0,due:due,st:PAYST_MAP[stt]||'chua_den_han',paid:(stt==='Đã thanh toán')?new Date().toISOString():null,sourceApp:'qt-artist-manager',entityType:'payment',jobId:eventId,updatedAt:new Date().toISOString()});n++;}});
 SpreadsheetApp.getUi().alert('Đã đẩy '+n+' đợt thu (từ '+ev+' HĐ) — CHỈ tiền, KHÔNG đụng job.');
}
/* Xoá sample data: job demo + toàn bộ pays/exps/docs/tasks/contracts mẫu. GIỮ lịch thật. */
function clearSampleData(){var ui=SpreadsheetApp.getUi();
 if(ui.alert('Xoá sample data trên app?','Xoá job demo + toàn bộ pays/exps/docs/tasks/contracts mẫu. GIỮ lịch g1–g106 thật. Không thể hoàn tác.',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
 del_('jobs','demo1');
 var n=0;['pays','exps','docs','tasks','contracts'].forEach(function(c){listIds_(c).forEach(function(id){del_(c,id);n++;});});
 ui.alert('Đã xoá job demo + '+n+' bản ghi pays/exps/docs/tasks/contracts mẫu. Lịch thật được giữ. (Bấm ②b để nạp lại tiền từ Hợp đồng.)');
}
/* 🧹 Gộp sự kiện TRÙNG theo Ngày + Tên — xoá bản dư trên app (giữ bản nhiều field nhất) và trên Sheet */
function _dDayVN(s){ if(!s)return ''; try{ return Utilities.formatDate(new Date(s),'Asia/Ho_Chi_Minh','yyyy-MM-dd'); }catch(e){ return String(s).slice(0,10); } }
function _dTok(s){ var x=String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim(); return x?x.split(/\s+/):[]; }
function _dSim(a,b){ // true nếu tập từ ngắn ⊆ tập từ dài (cho phép viết tắt: token ≥2 ký tự khớp theo tiền tố)
  var sh=a.length<=b.length?a:b, lo=a.length<=b.length?b:a; if(!sh.length||!lo.length)return false;
  return sh.every(function(t){ return lo.some(function(u){ return u===t || (t.length>=2&&u.indexOf(t)===0) || (u.length>=2&&t.indexOf(u)===0); }); });
}
function dedupEvents(){
 var ui=SpreadsheetApp.getUi();
 if(ui.alert('Gộp sự kiện trùng (Ngày + Tên gần giống)?','Gộp cả các bản tên viết tắt/khác nhẹ trong cùng ngày (vd "NH Bến Thành" ↔ "Nhà hát Bến Thành"). Giữ bản đầy đủ nhất. Không hoàn tác.',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
 // 1) App: cụm theo NGÀY (giờ VN) + tên gần giống; giữ bản nhiều field nhất
 var delApp=0, kept=[]; // kept: {date, tok, id}
 try{
  var jobs=(typeof evListJobs==='function')?evListJobs():{};
  var byDate={};
  for(var id in jobs){var jb=jobs[id];if(!jb||!jb.name)continue;var d=_dDayVN(jb.start);(byDate[d]=byDate[d]||[]).push({id:jb.id||id,tok:_dTok(jb.name),n:Object.keys(jb).length});}
  for(var d in byDate){var arr=byDate[d],used=[];
   for(var i=0;i<arr.length;i++){ if(used[i])continue; var cl=[arr[i]];used[i]=1;
    for(var j=i+1;j<arr.length;j++){ if(!used[j]&&_dSim(arr[i].tok,arr[j].tok)){cl.push(arr[j]);used[j]=1;} }
    cl.sort(function(a,b){return b.n-a.n;});
    kept.push({date:d,tok:cl[0].tok,id:cl[0].id});
    for(var c=1;c<cl.length;c++){del_('jobs',cl[c].id);delApp++;}
   }}
 }catch(e){}
 function keptIdFor_(d,tok){ for(var i=0;i<kept.length;i++){ if(kept[i].date===d&&_dSim(kept[i].tok,tok))return kept[i].id; } return ''; }
 // 2) Sheet: cụm cùng ngày + tên gần giống; giữ 1 dòng, gắn Mã = job app còn giữ
 var delSheet=0, fixedId=0;
 var sh=SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
 if(sh){var data=sh.getDataRange().getValues();var h=(data[0]||[]).map(function(x){return String(x).trim();});var ci={};h.forEach(function(x,i){var key=keyForHeader_(x);if(key)ci[key]=i;});
  var di=ci['date'],ti=ci['title'],ei=ci['eventId'];
  if(di!==undefined&&ti!==undefined){
   var keepersByDate={}, rm=[];
   for(var r=1;r<data.length;r++){var dv=toYMD_(data[r][di]);var tv=_dTok(data[r][ti]);if(!dv&&!tv.length)continue;
    var ks=keepersByDate[dv]=keepersByDate[dv]||[];
    var dup=false; for(var q=0;q<ks.length;q++){ if(_dSim(ks[q],tv)){dup=true;break;} }
    if(dup){rm.push(r+1);}
    else{ks.push(tv); if(ei!==undefined){var kid=keptIdFor_(dv,tv); if(kid&&String(data[r][ei]||'').trim()!==kid){sh.getRange(r+1,ei+1).setValue(kid);fixedId++;}}}
   }
   for(var i2=rm.length-1;i2>=0;i2--){sh.deleteRow(rm[i2]);delSheet++;}}}
 ui.alert('Đã gộp trùng (so khớp mờ):\n• App: xoá '+delApp+' bản trùng.\n• Sheet: xoá '+delSheet+' dòng, đồng bộ '+fixedId+' Mã sự kiện.');
}
function resetApp(){var ui=SpreadsheetApp.getUi();if(ui.alert('Xoá toàn bộ jobs & pays trên app?','Để Sheet làm nguồn chính.',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;['jobs','pays'].forEach(function(c){listIds_(c).forEach(function(id){del_(c,id);});});ui.alert('Đã xoá. Bấm ② để nạp lại.');}
