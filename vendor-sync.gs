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
 * 2. appsscript.json cần các scope sau (thêm nếu thiếu):
 *      "https://www.googleapis.com/auth/datastore",
 *      "https://www.googleapis.com/auth/spreadsheets",
 *      "https://www.googleapis.com/auth/script.scriptapp"   <-- cần để cài trigger tự động
 * 3. Chạy hàm  installVendorTriggers  1 lần (cấp quyền khi được hỏi).
 * 4. Chạy  setupVendorSheet  để tạo tab "Nhà cung cấp" (nếu chưa có).
 * 5. Xong: sửa trên Sheet là tự lên app; app thêm là tự về Sheet (≤5 phút / bấm "⟳ Sync danh bạ").
 ****************************************************************/

var FS_PROJECT   = "qt-manager-c55f4";
var VENDOR_SHEET = "Nhà cung cấp";
var VCOLS = ["id","name","role","phone","fb","cccd","bankNo","bankName","branch","payCompany","updatedAt"];

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
  var fields = {}; VCOLS.forEach(function(k){ fields[k] = fsToVal(o[k]); });
  var url = fsBase()+"/vendors/"+encodeURIComponent(o.id);
  UrlFetchApp.fetch(url, {method:"patch", contentType:"application/json", headers:fsHeaders(), muteHttpExceptions:true, payload:JSON.stringify({fields:fields})});
}

function getVendorSheet(){
  var ss = SpreadsheetApp.getActive(); var sh = ss.getSheetByName(VENDOR_SHEET);
  if(!sh){ sh = ss.insertSheet(VENDOR_SHEET); sh.getRange(1,1,1,VCOLS.length).setValues([VCOLS]); sh.setFrozenRows(1); }
  return sh;
}
function setupVendorSheet(){
  var sh = getVendorSheet();
  sh.getRange(1,1,1,VCOLS.length).setValues([VCOLS]).setFontWeight("bold");
  var roleCol = VCOLS.indexOf("role")+1;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(["makeup","photo","social","band","dancer","driver"]).build();
  sh.getRange(2,roleCol,500,1).setDataValidation(rule);
  syncVendors();
}

function readSheetVendors(){
  var sh = getVendorSheet(); var rng = sh.getDataRange().getValues(); var head = rng[0]; var out = [];
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

// (tuỳ chọn) thêm vào menu
function addVendorMenu(){
  SpreadsheetApp.getUi().createMenu("Danh bạ").addItem("⟳ Sync danh bạ ngay","syncVendors").addItem("Tạo tab Nhà cung cấp","setupVendorSheet").addItem("Cài tự động","installVendorTriggers").addToUi();
}
