/****************************************************************
 * QT Manager — Tạo Hợp đồng / BBNT / ĐNTT / Phụ lục → Google Drive
 * Dựng đúng MẪU HĐ Heart Soldier (Quốc Thiên). Bên B cố định.
 * App POST dữ liệu → script tạo Google Doc → set quyền "ai có link comment"
 * → trả {url}. KHÔNG cần file template (tự dựng nội dung).
 *
 * ===== CÀI ĐẶT 1 LẦN =====
 * 1. Dán file này vào Apps Script của project QT.
 * 2. (Tuỳ chọn) tạo 1 folder Drive chứa HĐ → dán ID vào FOLDER_ID.
 * 3. Deploy ▸ New deployment ▸ Web app (Execute as: Me, Access: Anyone) → copy URL.
 * 4. Dán URL vào biến CONTRACT_GEN_URL trong index.html → push.
 * Scope cần: Drive + Documents (tự xin khi deploy).
 ****************************************************************/

// Folder Drive gốc chứa hồ sơ (đã share quyền edit). Bên trong có thu/ , chi/ và sub-folder theo năm.
var ROOT_FOLDER_ID = "1Wzfh3SYPs5vprPHPCgo3hmPXA94HZK_G";
var FOLDER_ID = "";   // (tuỳ chọn) ép 1 folder cụ thể; để trống = tự chia theo thu/năm

// HĐ/BBNT/ĐNTT/PL là hồ sơ tiền THU về → nhánh "thu"
function targetFolder(d){
  if (FOLDER_ID) return DriveApp.getFolderById(FOLDER_ID);
  var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var thu = childFolder(root, "thu");
  var ev = d.date ? new Date(d.date) : (d.signDate ? new Date(d.signDate) : new Date());
  if (isNaN(ev)) ev = new Date();
  return childFolder(thu, String(ev.getFullYear()));
}
// tìm folder con theo tên (không phân biệt hoa/thường), không có thì tạo
function childFolder(parent, name){
  var it = parent.getFolders();
  while (it.hasNext()){ var f = it.next(); if (f.getName().toLowerCase() === name.toLowerCase()) return f; }
  return parent.createFolder(name);
}
// Tên file: YYYYMMDD - HD/BBNT/DNTT/PL - Tên sự kiện - Cty đối tác
function buildFileName(d, dtype){
  var ev = d.date ? new Date(d.date) : (d.signDate ? new Date(d.signDate) : new Date());
  if (isNaN(ev)) ev = new Date();
  var ymd = ev.getFullYear() + pad(ev.getMonth()+1) + pad(ev.getDate());
  var tmap = {"HĐ":"HD","BBNT":"BBNT","ĐNTT":"DNTT","Phụ lục":"PL"};
  var parts = [ymd, (tmap[dtype]||"HD"), (d.name||"Su kien"), (d.partner||"Doi tac")];
  return parts.join(" - ").replace(/[\/\\:*?"<>|]/g, "-").replace(/\s+/g," ").trim();
}

// ---- Bên B (cố định theo mẫu) ----
var BEN_B = {
  ten: "CÔNG TY TNHH HEART SOLDIER",
  truso: "Văn phòng 1, Tầng 9, Tòa nhà Pearl Plaza, 561A Điện Biên Phủ, Phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh, Việt Nam",
  mst: "0318280207",
  daidien: "Bà Đỗ Mộc Lan Vi", chucvu: "Tổng Giám Đốc",
  stk: "19 88 88 16", nganhang: "Ngân hàng TMCP Á Châu (ACB) - CN Thảo Điền - TP HCM",
  nghesi: "Quốc Thiên"
};

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var dtype = d.docType || "HĐ";
    var fname = buildFileName(d, dtype);
    var doc = DocumentApp.create(fname);
    var body = doc.getBody();
    if (dtype === "HĐ") buildContract(body, d);
    else buildOther(body, d, dtype);
    doc.saveAndClose();
    var f = DriveApp.getFileById(doc.getId());
    try { var folder = targetFolder(d); folder.addFile(f); DriveApp.getRootFolder().removeFile(f); } catch (e2) {}
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.COMMENT);
    return json({ ok: true, url: f.getUrl(), id: f.getId(), name: fname });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}
function doGet(){ return json({ ok:true, msg:"QT contract generator running. POST to use." }); }

// ===== Dựng HỢP ĐỒNG đầy đủ =====
function buildContract(b, d){
  var C = DocumentApp.ParagraphHeading;
  var center = DocumentApp.HorizontalAlignment.CENTER;
  function p(t){ return b.appendParagraph(t||""); }
  function bold(t){ var x=p(t); x.editAsText().setBold(true); return x; }
  function center_(x){ x.setAlignment(center); return x; }

  center_(bold("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"));
  center_(p("Độc lập – Tự do – Hạnh phúc"));
  center_(p("-------------------------------------"));
  center_(p("Thành phố Hồ Chí Minh, " + dateVN(d.signDate)));
  var t = center_(bold("HỢP ĐỒNG DỊCH VỤ BIỂU DIỄN NGHỆ THUẬT")); t.setHeading(C.HEADING1);
  center_(p("( Số: " + (d.contractNo || "..........") + " )"));
  p("");
  p("• Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 24/11/2015 và các văn bản hướng dẫn thi hành;");
  p("• Căn cứ Luật Thương mại số 36/2005/QH11 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 14/6/2005 và các văn bản hướng dẫn thi hành;");
  p("• Căn cứ Luật Sở hữu trí tuệ số 50/2005/QH11 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 29/11/2005 và các văn bản hướng dẫn thi hành;");
  p("• Căn cứ vào nhu cầu và khả năng của hai Bên,");
  p("Hợp Đồng dịch vụ biểu diễn nghệ thuật này (sau đây gọi tắt là “Hợp Đồng”) được lập giữa các Bên:");

  bold("BÊN SỬ DỤNG DỊCH VỤ (BÊN A): " + (d.partner || ".........."));
  p("Trụ sở: " + (d.address || ".........."));
  p("Mã số thuế: " + (d.taxCode || ".........."));
  p("Đại diện bởi: " + (d.rep || "..........") + "     Chức vụ: " + (d.repTitle || ".........."));
  if (d.phone) p("Số điện thoại: " + d.phone);
  if (d.email) p("Email: " + d.email);
  p("(Sau đây gọi tắt là “Bên A”)");
  p("Và,");
  bold("BÊN CUNG CẤP DỊCH VỤ (BÊN B): " + BEN_B.ten);
  p("Trụ sở: " + BEN_B.truso);
  p("Mã số thuế: " + BEN_B.mst);
  p("Đại diện bởi: " + BEN_B.daidien + "     Chức vụ: " + BEN_B.chucvu);
  p("Số tài khoản: " + BEN_B.stk + " tại " + BEN_B.nganhang);
  p("(Sau đây gọi tắt là “Bên B”)");
  p("Bên A và Bên B sau đây được gọi chung là “các Bên”. Các Bên thống nhất ký kết và thực hiện Hợp Đồng với những nội dung sau:");

  bold("ĐIỀU 1. ĐỊNH NGHĨA VÀ DIỄN GIẢI").setHeading(C.HEADING2);
  p("Trong Hợp Đồng này: “Hợp Đồng” là thỏa thuận giữa các Bên (bao gồm phụ lục kèm theo); “Dịch vụ” là các công việc mỗi Bên thực hiện theo Hợp Đồng; “Bên thứ ba” là tổ chức, cá nhân không ký kết Hợp Đồng; “Ngày làm việc” là ngày bất kỳ trừ Chủ nhật và ngày nghỉ lễ theo quy định pháp luật.");

  bold("ĐIỀU 2. ĐỐI TƯỢNG CỦA HỢP ĐỒNG").setHeading(C.HEADING2);
  p("1. Bên A mời Nghệ sĩ " + BEN_B.nghesi + " (“Nghệ sĩ”) tham gia biểu diễn tại chương trình do Bên A tổ chức. Bên B là đơn vị đại diện hợp pháp cho Nghệ sĩ, bảo đảm sự tham gia biểu diễn theo yêu cầu của Bên A. Thông tin Sự kiện:");
  p("• Tên Sự kiện: " + (d.name || ".........."));
  p("• Số lượng tác phẩm do Nghệ sĩ biểu diễn: " + (d.songsCount || "01 – 04") + " bài, theo danh sách beat có sẵn của Bên B, biểu diễn liên tục không ngắt quãng.");
  p("• Trang phục biểu diễn: được hai Bên thống nhất bằng văn bản hoặc email tối thiểu 05 (năm) ngày trước ngày diễn ra Sự kiện.");
  p("• Địa điểm diễn ra Sự kiện: " + (d.location || ".........."));
  p("• Thời gian diễn ra Sự kiện: " + (dmy(d.date) || ".........."));
  p("• Các nội dung chi tiết về lịch trình, tiết mục, yêu cầu kỹ thuật và điều khoản liên quan được hai Bên thống nhất bằng Phụ lục Hợp Đồng tối thiểu 03 (ba) ngày trước ngày diễn ra Sự kiện.");
  p("2. Dịch vụ do Bên B cung cấp: đảm bảo Nghệ sĩ biểu diễn đúng thời gian, địa điểm, nội dung, kịch bản, số lượng tiết mục; tham dự đầy đủ tổng duyệt/tập luyện/ghi hình/phỏng vấn theo yêu cầu hợp lý của Bên A; phối hợp tổ chức, truyền thông; tuân thủ quy định về hình ảnh, trang phục, tác phong; thông báo kịp thời khi phát sinh thay đổi/sự cố.");

  bold("ĐIỀU 3. GIÁ TRỊ HỢP ĐỒNG VÀ THANH TOÁN").setHeading(C.HEADING2);
  bold("1. Giá trị Hợp Đồng");
  p("• Giá trị Hợp Đồng trước thuế: " + money(d.valuePreTax) + " VND");
  p("• Thuế GTGT " + (d.taxRate || 0) + "%: " + money((d.totalValue||0) - (d.valuePreTax||0)) + " VND");
  p("• Tổng giá trị Hợp Đồng sau thuế: " + money(d.totalValue) + " VND");
  p("• Bằng chữ: " + readVN(d.totalValue) + "./.");
  p("• Giá trị Hợp Đồng đã bao gồm thuế, phí theo quy định; chi phí đi lại, ăn ở, trang phục, trang thiết bị phục vụ biểu diễn của Bên B và mọi chi phí khác liên quan trực tiếp đến biểu diễn. Bên A không thanh toán thêm khoản nào ngoài Giá trị Hợp Đồng, trừ khi có thỏa thuận bổ sung bằng văn bản.");
  bold("2. Lộ trình thanh toán");
  var ins = d.installments || [];
  if (!ins.length) { p("Bên A thanh toán 100% giá trị Hợp Đồng cho Bên B sau khi hoàn tất chương trình."); }
  else ins.forEach(function(it, i){
    p("- Đợt " + (i+1) + ": Bên A thanh toán " + (it.pct||0) + "% giá trị Hợp Đồng, tương đương " + money(it.amount) + " VNĐ (Bằng chữ: " + readVN(it.amount) + "./.)" + (it.dueNote ? (" — " + it.dueNote) : (i===0 ? " kể từ ngày hai Bên ký kết Hợp Đồng." : " trước 03 ngày diễn ra chương trình, sau khi hai Bên ký biên bản nghiệm thu, thanh lý và Bên B xuất hóa đơn tài chính hợp pháp.")));
  });
  p("Phương thức thanh toán: chuyển khoản vào tài khoản của Bên B:");
  p("• Tên đơn vị thụ hưởng: " + BEN_B.ten);
  p("• Số tài khoản: " + BEN_B.stk + " — " + BEN_B.nganhang);

  bold("ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A").setHeading(C.HEADING2);
  p("Bên A có quyền yêu cầu Bên B thực hiện đúng, đầy đủ, đúng hạn nội dung Dịch vụ; yêu cầu điều chỉnh nếu không đạt chất lượng/tiến độ. Bên A có nghĩa vụ thanh toán đầy đủ, đúng hạn theo Điều 3; chuẩn bị điều kiện tổ chức Sự kiện (sân khấu, âm thanh, ánh sáng, kỹ thuật, an ninh, giấy phép, địa điểm, bản quyền). Bên A được sử dụng hình ảnh, tên, giọng hát của Nghệ sĩ phục vụ truyền thông Chương trình, không làm sai lệch hình ảnh/danh dự Nghệ sĩ; không sử dụng ngoài phạm vi Hợp Đồng khi chưa có chấp thuận bằng văn bản của Bên B; thông báo kịp thời các thay đổi.");

  bold("ĐIỀU 5. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B").setHeading(C.HEADING2);
  p("Bên B tổ chức, điều phối, bảo đảm sự tham gia biểu diễn của Nghệ sĩ đúng nội dung, phạm vi, tiến độ, chất lượng đã thống nhất; phối hợp xây dựng kịch bản, thời lượng, danh mục bài hát, trang phục; thông báo ngay và đề xuất phương án thay thế khi Nghệ sĩ không thể biểu diễn vì lý do bất khả kháng; được thanh toán đầy đủ theo Hợp Đồng; bảo đảm tuân thủ pháp luật và quy tắc ứng xử nghề nghiệp.");

  bold("ĐIỀU 6. QUYỀN SỞ HỮU TRÍ TUỆ").setHeading(C.HEADING2);
  p("Bên A bảo đảm có quyền hợp pháp đối với ý tưởng, hình ảnh, nội dung, nhạc nền, kịch bản do Bên A cung cấp và chịu trách nhiệm với khiếu nại của bên thứ ba. Bên A thanh toán phí tác quyền âm nhạc đối với tác phẩm biểu diễn không thuộc quyền của Bên B. Bên B/Nghệ sĩ giữ quyền nhân thân đối với hình ảnh, giọng hát, tên, thương hiệu; đồng ý cho Bên A sử dụng trong phạm vi, mục đích, thời hạn Hợp Đồng; sử dụng vượt phạm vi phải có văn bản chấp thuận của Bên B. Các Bên phối hợp bảo vệ quyền sở hữu trí tuệ phát sinh.");

  bold("ĐIỀU 7. BẢO MẬT THÔNG TIN").setHeading(C.HEADING2);
  p("Bên B cam kết các sản phẩm cung cấp không vi phạm quyền sở hữu trí tuệ của bên thứ ba; bảo mật mọi thông tin có được trong quá trình thực hiện Hợp Đồng (thông tin khách hàng, kế hoạch, truyền thông, tài chính dự án…); không chia sẻ thông tin/hình ảnh hậu trường lên mạng xã hội khi chưa được Bên A đồng ý bằng văn bản; không sử dụng hình ảnh, thương hiệu Bên A vì mục đích cá nhân gây thiệt hại. Trách nhiệm bảo mật có hiệu lực trong suốt và sau khi Hợp Đồng chấm dứt.");

  bold("ĐIỀU 8. CAM KẾT CHUNG").setHeading(C.HEADING2);
  p("Hai Bên thực hiện đầy đủ, kịp thời các công việc; mọi thay đổi phải có văn bản đồng ý của cả hai Bên. Tranh chấp được giải quyết qua thương lượng thiện chí; nếu không được, đưa ra Tòa án Nhân dân TP. Hồ Chí Minh, bên thua kiện chịu chi phí. Cá nhân ký kết là người có đủ thẩm quyền. Hợp Đồng có hiệu lực kể từ ngày ký.");

  bold("ĐIỀU 9. THỜI HẠN HIỆU LỰC").setHeading(C.HEADING2);
  p("Hợp Đồng có hiệu lực đến khi Bên B hoàn tất công việc và được Bên A thanh toán đầy đủ. Hợp Đồng được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi Bên giữ 01 (một) bản.");
  p("");

  var tb = b.appendTable([["ĐẠI DIỆN BÊN A", "ĐẠI DIỆN BÊN B"], ["\n\n\n" + (d.rep || ""), "\n\n\n" + BEN_B.daidien.replace(/^Bà |^Ông /,"")], [(d.repTitle||""), BEN_B.chucvu]]);
  tb.setBorderWidth(0);
}

// ===== BBNT / ĐNTT / Phụ lục (bản gọn) =====
function buildOther(b, d, type){
  var heads={"BBNT":"BIÊN BẢN NGHIỆM THU & THANH LÝ HỢP ĐỒNG","ĐNTT":"ĐỀ NGHỊ THANH TOÁN","Phụ lục":"PHỤ LỤC HỢP ĐỒNG"};
  var t=b.appendParagraph(heads[type]||type);t.setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  b.appendParagraph("Hợp đồng số: "+(d.contractNo||"")+"   Ngày ký: "+dmy(d.signDate));
  b.appendParagraph("Bên A: "+(d.partner||""));
  b.appendParagraph("Bên B: "+BEN_B.ten);
  b.appendParagraph("Sự kiện: "+(d.name||"")+"   Ngày diễn: "+(dmy(d.date)||""));
  b.appendParagraph("Tổng giá trị: "+money(d.totalValue)+" VND (Bằng chữ: "+readVN(d.totalValue)+"./.)");
  if(d.changeText){b.appendParagraph("");b.appendParagraph("Nội dung thay đổi / đề nghị:");b.appendParagraph(d.changeText);}
  b.appendParagraph("");b.appendParagraph("(Văn bản tạo tự động từ QT Manager — vui lòng rà soát & bổ sung.)").editAsText().setItalic(true);
}

// ===== Helpers =====
function money(n){ n=Math.round(Number(n)||0); return n.toLocaleString("en-US").replace(/,/g,","); }
function dmy(s){ if(!s)return ""; var d=new Date(s); if(isNaN(d))return s; return pad(d.getDate())+"/"+pad(d.getMonth()+1)+"/"+d.getFullYear(); }
function dateVN(s){ var d=s?new Date(s):new Date(); if(isNaN(d))d=new Date(); return "ngày "+pad(d.getDate())+" tháng "+pad(d.getMonth()+1)+" năm "+d.getFullYear(); }
function pad(n){ return n<10?("0"+n):(""+n); }
function readVN(n){
  n=Math.round(Number(n)||0); if(n===0) return "Không đồng";
  var don=["","một","hai","ba","bốn","năm","sáu","bảy","tám","chín"];
  function d3(num,full){ var tr=Math.floor(num/100),ch=Math.floor((num%100)/10),dv=num%10,s="";
    if(tr>0)s+=don[tr]+" trăm";
    if(ch>1){s+=" "+don[ch]+" mươi"; if(dv===1)s+=" mốt"; else if(dv===5)s+=" lăm"; else if(dv>0)s+=" "+don[dv];}
    else if(ch===1){s+=" mười"; if(dv===5)s+=" lăm"; else if(dv>0)s+=" "+don[dv];}
    else if(dv>0){ s+=((tr>0||!full)?" lẻ ":"")+don[dv]; }
    return s.trim();
  }
  var units=[""," nghìn"," triệu"," tỷ"]; var g=[]; while(n>0){g.push(n%1000);n=Math.floor(n/1000);}
  var parts=[]; for(var i=g.length-1;i>=0;i--){ if(g[i]===0)continue; parts.push(d3(g[i], i===g.length-1)+units[i]); }
  var s=parts.join(" ").replace(/\s+/g," ").trim(); s=s.charAt(0).toUpperCase()+s.slice(1);
  return s+" đồng";
}
function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
