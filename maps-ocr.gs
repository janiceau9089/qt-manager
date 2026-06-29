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
    if(req.action === "maps")      out = doMaps_(req);
    else if(req.action === "ocr")  out = doOcr_(req);
    else                           out = { error:"unknown action (cần 'maps' hoặc 'ocr')" };
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

/* ============ OCR ============ */
function doOcr_(req){
  var b64 = String(req.fileBase64||"");
  if(!b64) return { error:"thiếu file (fileBase64)" };
  var comma = b64.indexOf(",");
  if(b64.substr(0,5)==="data:" && comma>0) b64 = b64.substr(comma+1);   // bỏ tiền tố data URL
  var mime = req.mimeType || "image/jpeg";
  var kind = req.kind || "text";
  var text;
  try{ text = ocrText_(Utilities.newBlob(Utilities.base64Decode(b64), mime, "qt-ocr")); }
  catch(err){ return { error:"OCR lỗi (đã bật Drive API service chưa?): "+String(err) }; }
  var parsed = kind==="flight" ? parseFlight_(text) : (kind==="contract" ? parseContract_(text) : {});
  return { text:text, parsed:parsed };
}
function ocrText_(blob){
  var meta = { title:"qt-ocr-"+Date.now(), mimeType:"application/vnd.google-apps.document" };
  var file;
  try{ file = Drive.Files.insert(meta, blob, { ocr:true, ocrLanguage:"vi" }); }       // Drive API v2
  catch(e1){ file = Drive.Files.create({ name:meta.title, mimeType:meta.mimeType }, blob, { ocr:true, ocrLanguage:"vi" }); } // v3 fallback
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
