/****************************************************************
 * QT Manager — MAPS + OCR  (Apps Script Web App, MIỄN PHÍ)
 * ---------------------------------------------------------------
 * KHÔNG cần khóa API / thẻ tín dụng:
 *   - Maps : dịch vụ Maps có sẵn của Apps Script (Maps.newDirectionFinder).
 *   - OCR  : Drive OCR (convert ảnh/PDF → Google Doc kèm OCR), free.
 *
 * ===== CÀI ĐẶT 1 LẦN =====
 * 1. Apps Script (cùng project QT) → + → Script, tên "maps-ocr". Dán toàn bộ file này. Lưu.
 * 2. Bật Advanced Drive Service (cho OCR):
 *      Apps Script → ⚙? Không — bấm "Services" (dấu +) bên trái → chọn "Drive API" → Add.
 * 3. appsscript.json oauthScopes cần có (dán đè cho chắc):
 *      "https://www.googleapis.com/auth/script.external_request",
 *      "https://www.googleapis.com/auth/drive",
 *      "https://www.googleapis.com/auth/documents",
 *      "https://www.googleapis.com/auth/maps"   (đôi khi tự thêm khi Maps chạy lần đầu)
 * 4. Deploy → New deployment → Web app:
 *      Execute as: Me   |   Who has access: Anyone
 *    → Deploy → cấp quyền (Advanced → Allow).
 * 5. Copy Web app URL (…/exec) → dán vào app: var MAPS_OCR_URL="…".
 ****************************************************************/

function doGet(e){
  return _json({ ok:true, msg:"QT maps-ocr alive", time:new Date().toISOString() });
}
function doPost(e){
  var out;
  try{
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if(req.action === "maps")          out = doMaps_(req);
    else if(req.action === "ocr")      out = doOcr_(req);
    else if(req.action === "drivelist")out = doDrive_(req);
    else if(req.action === "sheetlist")out = doSheet_(req);
    else                               out = { error:"unknown action (cần 'maps' | 'ocr' | 'drivelist' | 'sheetlist')" };
  }catch(err){ out = { error:String(err) }; }
  return _json(out);
}
function _json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ============ MAPS ============ */
function doMaps_(req){
  var origin = String(req.origin||"").trim();
  var dest   = String(req.destination||"").trim();
  if(!origin || !dest) return { error:"thiếu origin/destination" };
  var modeMap = Maps.DirectionFinder.Mode;
  var mode = ({walking:modeMap.WALKING, bicycling:modeMap.BICYCLING, transit:modeMap.TRANSIT}[req.mode]) || modeMap.DRIVING;
  var df = Maps.newDirectionFinder().setOrigin(origin).setDestination(dest).setMode(mode);
  var r = df.getDirections();
  if(!r || !r.routes || !r.routes.length) return { error:"không tìm được tuyến đường" };
  var meters=0, secs=0;
  r.routes[0].legs.forEach(function(l){ meters += l.distance.value; secs += l.duration.value; });
  var km = Math.round(meters/100)/10;        // 1 chữ số thập phân
  var min = Math.round(secs/60);
  return { km:km, min:min, kmText:km+" km", minText:min+" phút",
           startAddress:r.routes[0].legs[0].start_address, endAddress:r.routes[0].legs[r.routes[0].legs.length-1].end_address };
}

/* ============ DRIVE LIST (liệt kê file trong folder) ============ */
function doDrive_(req){
  var fid = String(req.folderId||"").trim();
  if(!fid) return { error:"thiếu folderId" };
  var folder;
  try{ folder = DriveApp.getFolderById(fid); }
  catch(e){ return { error:"không mở được folder (đã share với tài khoản chạy script chưa?): "+String(e) }; }
  var it = folder.getFiles(), out = [];
  while(it.hasNext()){
    var f = it.next();
    out.push({ name: f.getName().replace(/\.[A-Za-z0-9]{1,5}$/,""), url: f.getUrl() });   // bỏ đuôi file cho gọn
  }
  out.sort(function(a,b){ return a.name.localeCompare(b.name, "vi"); });
  return { files: out, count: out.length, folderName: folder.getName() };
}

/* ============ SHEET LIST (đọc 1 sheet → tên + link, kèm link ẩn trong rich text) ============ */
function doSheet_(req){
  var sid = String(req.sheetId||"").trim();
  if(!sid) return { error:"thiếu sheetId" };
  var ss;
  try{ ss = SpreadsheetApp.openById(sid); }
  catch(e){ return { error:"không mở được sheet (đã share chưa?): "+String(e) }; }
  var sh = req.sheetName ? ss.getSheetByName(req.sheetName) : ss.getSheets()[0];
  if(!sh) return { error:"không thấy sheet" };
  var rng = sh.getDataRange(), vals = rng.getValues(), rich = rng.getRichTextValues();
  // tìm hàng header + cột (SỰ KIỆN / LINK / NĂM / THÁNG / NOTE)
  var hr=-1,cEvent=-1,cLink=-1,cYear=-1,cMonth=-1,cNote=-1;
  for(var r=0;r<Math.min(vals.length,6);r++){
    var row = vals[r].map(function(x){ return String(x).toUpperCase(); });
    var ie=-1,il=-1;
    for(var c=0;c<row.length;c++){
      if(row[c].indexOf("SỰ KIỆN")>=0||row[c].indexOf("SU KIEN")>=0) ie=c;
      if(row[c].indexOf("LINK")>=0) il=c;
    }
    if(ie>=0&&il>=0){ hr=r; cEvent=ie; cLink=il;
      for(var c2=0;c2<row.length;c2++){
        if(row[c2].indexOf("NĂM")>=0||row[c2]==="NAM") cYear=c2;
        if(row[c2].indexOf("THÁNG")>=0||row[c2].indexOf("THANG")>=0) cMonth=c2;
        if(row[c2].indexOf("NOTE")>=0||row[c2].indexOf("GHI CHÚ")>=0) cNote=c2;
      }
      break;
    }
  }
  if(hr<0) return { error:"không tìm thấy cột SỰ KIỆN / LINK trong sheet" };
  var out=[], curYear="";
  for(var r2=hr+1;r2<vals.length;r2++){
    var v=vals[r2];
    if(cYear>=0 && String(v[cYear]).trim()) curYear=String(v[cYear]).trim();
    var url="";
    var cell=rich[r2][cLink];
    if(cell){
      url = cell.getLinkUrl() || "";
      if(!url){ var runs=cell.getRuns(); for(var k=0;k<runs.length;k++){ var lu=runs[k].getLinkUrl(); if(lu){ url=lu; break; } } }
    }
    var raw=String(v[cLink]||"").trim();
    if(!url && /^https?:\/\//i.test(raw)) url=raw;
    if(!url) continue; // chỉ lấy dòng có link bấm được
    var name=String(v[cEvent]||"").trim() || raw || "(không tên)";
    out.push({ name:name, url:url, year:curYear,
               month:(cMonth>=0?String(v[cMonth]||"").trim():""),
               note:(cNote>=0?String(v[cNote]||"").trim():"") });
  }
  return { rows:out, count:out.length, title:sh.getName() };
}

/* ============ OCR ============ */
function doOcr_(req){
  var b64 = String(req.fileBase64||"");
  if(!b64) return { error:"thiếu file (fileBase64)" };
  var comma = b64.indexOf(",");
  if(b64.substr(0,5)==="data:" && comma>0) b64 = b64.substr(comma+1);   // bỏ tiền tố data URL
  var mime = req.mimeType || "image/jpeg";
  var kind = req.kind || "text";
  var text;
  try{ text = ocrText_(Utilities.newBlob(Utilities.base64Decode(b64), mime, "qt-ocr"), mime); }
  catch(err){ return { error:"Đọc file lỗi (đã bật Drive API service chưa?): "+String(err) }; }
  var parsed = kind==="flight" ? parseFlight_(text) : (kind==="contract" ? parseContract_(text) : {});
  return { text:text, parsed:parsed };
}
function ocrText_(blob, mime){
  mime = mime || "";
  var isImgPdf = /^image\//.test(mime) || mime === "application/pdf";
  // Ảnh/PDF → OCR; Word (.doc/.docx) → chỉ convert sang Google Doc (lấy text chuẩn, không cần OCR)
  var opts = isImgPdf ? { ocr:true, ocrLanguage:"vi" } : {};
  var meta = { title:"qt-ocr-"+Date.now(), mimeType:"application/vnd.google-apps.document" };
  var file;
  try{ file = Drive.Files.insert(meta, blob, opts); }       // Drive API v2
  catch(e1){ file = Drive.Files.create({ name:meta.title, mimeType:meta.mimeType }, blob, opts); } // v3 fallback
  var id = file.id;
  var text = DocumentApp.openById(id).getBody().getText();
  try{ Drive.Files.remove(id); }catch(e){ try{ DriveApp.getFileById(id).setTrashed(true); }catch(e2){} }   // dọn file tạm
  return text;
}

/* ---- bóc tách vé máy bay ---- */
var AIRPORTS = {SGN:"Tân Sơn Nhất",HAN:"Nội Bài",DAD:"Đà Nẵng",CXR:"Cam Ranh",PQC:"Phú Quốc",HPH:"Cát Bi",VCA:"Cần Thơ",HUI:"Phú Bài",DLI:"Liên Khương",UIH:"Phù Cát",VII:"Vinh",BMV:"Buôn Ma Thuột",VDO:"Vân Đồn",THD:"Thọ Xuân",TBB:"Tuy Hòa",VCS:"Côn Đảo"};
function parseFlight_(t){
  t = String(t||"");
  var up = t.toUpperCase();
  var o = {};
  var fn = up.match(/\b(VN|VJ|QH|BL|VU)\s?-?\s?(\d{2,4})\b/);                 // hãng VN
  if(fn) o.no = fn[1] + fn[2];
  var codes = (up.match(/\b[A-Z]{3}\b/g)||[]).filter(function(c){ return AIRPORTS[c]; });
  if(codes.length>=2) o.route = codes[0] + " → " + codes[1];
  else if(codes.length===1) o.route = codes[0];
  var pnr = up.match(/\b(?:PNR|MÃ ĐẶT CHỖ|BOOKING)\D{0,8}([A-Z0-9]{6})\b/) || up.match(/\b([A-Z0-9]{6})\b/);
  if(pnr && (!o.no || pnr[1]!==o.no)) o.code = pnr[1];
  var times = (t.match(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/g)||[]).map(function(s){ return s.replace(/[hH]/,":"); });
  if(times[0]) o.depart = times[0];
  if(times[1]) o.arrive = times[1];
  return o;
}
/* ---- bóc tách hợp đồng (nhẹ — client còn dùng parsePartnerInfo) ---- */
function parseContract_(t){
  t = String(t||"");
  var o = {};
  var partner = t.match(/(C[ÔO]NG TY[^\n]{3,80})/i);
  if(partner) o.partner = partner[1].trim().replace(/\s+/g," ");
  var mst = t.match(/\b\d{10}(\d{3})?\b/);
  if(mst) o.taxCode = mst[0];
  var nums = (t.match(/\d{1,3}(?:[.,]\d{3})+/g)||[]).map(function(s){ return parseInt(s.replace(/[^\d]/g,""),10); }).filter(function(n){ return n>=1000000; });
  if(nums.length) o.value = Math.max.apply(null, nums);
  return o;
}
