/****************************************************************
 * QT Manager — Tạo Hợp đồng từ mẫu → Google Drive
 * ---------------------------------------------------------------
 * CHỨC NĂNG: App gửi thông tin HĐ (nhập tay) tới đây → script tạo
 * 1 Google Doc hợp đồng, đặt trong folder Drive, chỉnh quyền
 * "Bất kỳ ai có link đều được COMMENT", rồi trả link về cho app.
 *
 * ===== CÀI ĐẶT 1 LẦN =====
 * 1. Mở Apps Script của project QT (cùng nơi chứa firestore-sync.gs),
 *    tạo file mới tên "contract-gen.gs" và dán toàn bộ nội dung này.
 * 2. (Tuỳ chọn) Tạo 1 Google Doc MẪU hợp đồng, trong đó dùng các
 *    placeholder dạng {{CONG_TY}}, {{MST}}, {{TONG}}... (xem danh sách
 *    PLACEHOLDERS bên dưới). Copy ID của Doc mẫu dán vào TEMPLATE_DOC_ID.
 *    Nếu để trống TEMPLATE_DOC_ID, script sẽ tự tạo Doc mới đơn giản.
 * 3. (Tuỳ chọn) Tạo 1 folder Drive để chứa HĐ, dán ID vào FOLDER_ID.
 *    Để trống = lưu ở thư mục gốc My Drive.
 * 4. Deploy: Deploy ▸ New deployment ▸ type "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    Bấm Deploy, cấp quyền (Drive + Documents), copy "Web app URL".
 * 5. Dán URL đó vào biến CONTRACT_GEN_URL ở đầu phần <script> trong
 *    index.html (và qt-manager-demo.html) rồi push lại.
 *
 * ===== PLACEHOLDERS dùng trong Doc mẫu =====
 *  {{SO_HD}} {{NGAY_KY}} {{SU_KIEN}} {{NGAY_DIEN}} {{DIA_DIEM}}
 *  {{CONG_TY}} {{DIA_CHI}} {{MST}} {{DAI_DIEN}} {{CHUC_VU}} {{SDT}} {{EMAIL}}
 *  {{STK}} {{NGAN_HANG}} {{CHI_NHANH}} {{TK_NHAN}}
 *  {{GIA_TRI}} {{THUE}} {{TONG}} {{DOT_TT}}
 ****************************************************************/

var TEMPLATE_DOC_ID = "";   // ID Google Doc mẫu (để trống = tạo Doc mới)
var FOLDER_ID       = "";   // ID folder Drive chứa HĐ (để trống = My Drive)

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var title = "HĐ - " + (d.name || "Su kien") + (d.partner ? (" - " + d.partner) : "");
    var folder = FOLDER_ID ? DriveApp.getFolderById(FOLDER_ID) : DriveApp.getRootFolder();
    var docFile, doc;

    if (TEMPLATE_DOC_ID) {
      docFile = DriveApp.getFileById(TEMPLATE_DOC_ID).makeCopy(title, folder);
      doc = DocumentApp.openById(docFile.getId());
      fillPlaceholders(doc.getBody(), d);
    } else {
      doc = DocumentApp.create(title);
      buildDefaultDoc(doc.getBody(), d);
      docFile = DriveApp.getFileById(doc.getId());
      if (FOLDER_ID) { folder.addFile(docFile); DriveApp.getRootFolder().removeFile(docFile); }
    }
    doc.saveAndClose();

    // Ai có link đều COMMENT được
    docFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.COMMENT);

    return json({ ok: true, url: docFile.getUrl(), id: docFile.getId() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, msg: "QT contract generator is running. Use POST." });
}

function fillPlaceholders(body, d) {
  var map = placeholderMap(d);
  Object.keys(map).forEach(function (k) {
    body.replaceText("\\{\\{" + k + "\\}\\}", map[k]);
  });
}

function placeholderMap(d) {
  return {
    "SO_HD": d.contractNo || "",
    "NGAY_KY": d.signDate || "",
    "SU_KIEN": d.name || "",
    "NGAY_DIEN": d.date || "",
    "DIA_DIEM": d.location || "",
    "CONG_TY": d.partner || "",
    "DIA_CHI": d.address || "",
    "MST": d.taxCode || "",
    "DAI_DIEN": d.rep || "",
    "CHUC_VU": d.repTitle || "",
    "SDT": d.phone || "",
    "EMAIL": d.email || "",
    "STK": d.bankNo || "",
    "NGAN_HANG": d.bankName || "",
    "CHI_NHANH": d.branch || "",
    "TK_NHAN": d.ourAccount || "",
    "GIA_TRI": money(d.valuePreTax),
    "THUE": (d.taxRate || 0) + "%",
    "TONG": money(d.totalValue),
    "DOT_TT": instText(d.installments)
  };
}

function buildDefaultDoc(body, d) {
  body.appendParagraph("HỢP ĐỒNG DỊCH VỤ BIỂU DIỄN").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("Số HĐ: " + (d.contractNo || "..........") + "      Ngày ký: " + (d.signDate || ".........."));
  body.appendParagraph("");
  body.appendParagraph("BÊN A (Đối tác):").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("Công ty: " + (d.partner || ""));
  body.appendParagraph("Địa chỉ: " + (d.address || ""));
  body.appendParagraph("MST: " + (d.taxCode || ""));
  body.appendParagraph("Đại diện: " + (d.rep || "") + (d.repTitle ? ("  -  Chức vụ: " + d.repTitle) : ""));
  body.appendParagraph("SĐT: " + (d.phone || "") + "      Email: " + (d.email || ""));
  body.appendParagraph("Tài khoản: " + (d.bankNo || "") + " - " + (d.bankName || "") + (d.branch ? (" - " + d.branch) : ""));
  body.appendParagraph("");
  body.appendParagraph("BÊN B: Nghệ sĩ Quốc Thiên").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("Tài khoản nhận: " + (d.ourAccount || ""));
  body.appendParagraph("");
  body.appendParagraph("NỘI DUNG").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("Sự kiện: " + (d.name || ""));
  body.appendParagraph("Ngày diễn: " + (d.date || "") + "      Địa điểm: " + (d.location || ""));
  body.appendParagraph("Giá trị trước thuế: " + money(d.valuePreTax));
  body.appendParagraph("Thuế VAT: " + ((d.taxRate || 0) + "%"));
  body.appendParagraph("TỔNG GIÁ TRỊ (gồm thuế): " + money(d.totalValue));
  body.appendParagraph("Các đợt thanh toán: " + instText(d.installments));
  body.appendParagraph("");
  body.appendParagraph("(Hợp đồng được tạo tự động từ QT Manager — vui lòng rà soát & bổ sung điều khoản.)").setItalic(true);
}

function instText(insts) {
  if (!insts || !insts.length) return "";
  return insts.map(function (x, i) {
    return "Đợt " + (i + 1) + ": " + (x.pct || 0) + "% = " + money(x.amount) + (x.dueDate ? (" (hạn " + x.dueDate + ")") : "");
  }).join("; ");
}

function money(n) {
  n = Number(n) || 0;
  return n.toLocaleString("vi-VN") + " ₫";
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
