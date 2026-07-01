/****************************************************************
 * Đổi tên hàng loạt file BEAT của Quốc Thiên
 *  - Viết hoa chữ đầu + thêm dấu tiếng Việt + dọn tag kỹ thuật (MO/PLB/BE/MASTER/by bac si…)
 *  - Giữ ghi chú phiên bản gọn: (Bè) (Remix) (Beat) (Playback)…
 *
 * CÁCH DÙNG:
 *  1. Tạo 1 Apps Script mới (script.google.com) bằng TÀI KHOẢN CÓ QUYỀN SỬA folder beat
 *     (hoặc dán vào project QT nếu tài khoản đó có quyền edit folder).
 *  2. Dán file này. Lưu.
 *  3. Chạy hàm  previewRename  trước → xem Log (Ctrl+Enter) để kiểm tra old → new.
 *  4. Ưng thì chạy  applyRename  để đổi thật.
 *  ⚠ Cần quyền EDIT folder beat. Tên trùng nhau Drive vẫn cho phép (các bản bè/remix).
 ****************************************************************/

var BEAT_FOLDER_ID = "1X7MN_mfwC9y8dS_-sU-1sHA-5GpK2bGT";

// id file -> tên mới (đã gồm đuôi). Sửa tự do trước khi chạy applyRename.
var RENAME = {
 "1-flUCQeAi16qTtbRd7445YnV14S0mgzI":"Điệp Khúc Mùa Xuân - MO.mp3",
 "1LieIB5oSskqvFelc93LvcCu-9xlu7G7V":"Chạm Vào Vinh Quang - MO.wav",
 "1j518IiDR3I1Q3I1Tst_gEMM5TSHIuS2J":"Cám Ơn Tình Yêu (Bb).wav",
 "1apIW61xiYG8oeTvwmE7xYTkOEBkvLUVk":"Chiều Một Mình Qua Phố - MO.mp3",
 "12BUg9UiCHfkJV3g2UPh4IR6otgCcOjvE":"Cám Ơn Tình Yêu (SC).wav",
 "1Bf_jrkyKZy3TBsQ6x0JIgMspweAQjPxQ":"Chúc Xuân - MO.mp3",
 "14PfWhaPt9J7X1TqNL9o5nE9ARbqx8c0Y":"Cánh Hồng Phai (Remix).wav",
 "12HG_4kYDNqnFGiqTyYvEHIoWLtQCdYQo":"Câu Chuyện Làm Quen - MO.wav",
 "1lqOfanjwVXSEJGa2PTlOsXxpl7ioXJDt":"Cơm Đoàn Viên - MO.wav",
 "18Ah9ePT6NKZyK84BhRKnuGEuWhGALmVa":"Cơm Đoàn Viên (Bè).wav",
 "1NiCwwHmc8ja-s4yDW5nlQTtq8qHeXaiW":"Đêm Cô Đơn - MO.wav",
 "1yZUFimq8Mt2Hj5ABu4lXgvEVJ6MThMDu":"Chia Cách Bình Yên - MO.wav",
 "1h5TStsVX1IOyzvXiryARLvBL4DBu43Xe":"Chia Cách Bình Yên (Remix).mp3",
 "15ROPzmbrOPanTBmNBj9d6tuaXu8Fy8Nw":"Chia Cách Bình Yên (No Sax).mp3",
 "1OgkvBfnXXmFqWnzFvuYzk3WRNfHKqzQU":"Cơn Mơ Băng Giá - MO.wav",
 "1Kp2eSdSRbEISkBTpy3BfQAx0iy2LamHs":"Ai Chung Tình Được Mãi - MO.wav",
 "16TWk4bEFBaotuuvUV0cYaW8QVJl8m6Yw":"Vạn Sự Tùy Duyên (Remix).wav",
 "1b_-r_nNpDrejj7xOzy18McOW4BU_6ena":"Sway - MO.mp3",
 "15A6h97gMJQEMs1nJHEbFdkm1ttHXpgX0":"LK Nửa Vầng Trăng - Tình Phai - MO.m4a",
 "1nU7kVXI05SeoUhfHB7AJKyIXWapWozkG":"You Raise Me Up - MO.mp3",
 "1_4Th5U-e5GcukvBaSTuMh_RiNvnqtsZK":"Ánh Nắng Của Anh - MO.mp3",
 "1blcG8fLz66nbpjrDAOIomnekBLTVUMVa":"LK Anh Khác Hay Em Khác - Ngỡ - MO.wav",
 "1EsURpMk0XFolkQs7epGSlhFSJ0uf7bEQ":"Buồn Thì Cứ Khóc Đi (JuongB Remix).wav",
 "1JnPMxeJcfHilVxFxjxAxfSAmvlqp3Ijb":"Những Kẻ Mộng Mơ (Bè).wav",
 "1CYCYEjMTgPcfJwiyXLrfEZoh4YSxpAmC":"Mong Manh Tình Về - MO.mp3",
 "1DXbT2JymRmzQQRZ5ZhcLVkrvTtd8pguT":"Hà Nội Đêm Trở Gió - MO.wav",
 "1OJw3Dc0Nz9cVDmVjG-ER5SU_gXnW5TKz":"Cánh Hồng Phai (Bè).wav",
 "1xuccMQu4wvu434ZSZV0ZPtzrxfB86kvD":"Bước Qua Đời Nhau (Bè).wav",
 "1RoSslgGEbEkgiA6pxOcpPkfeGgb_gzK5":"Mong Manh Tình Về (Beat).mp3",
 "1OD4s4kIDkb-CjeoSEpEV-M4cCLoCj8SL":"Anh Say Rồi (Bè).wav",
 "1pynJAUPVZF-R-s5sUg00e7hcHgJEZt3M":"Nỗi Đau Tận Cùng (Ballad).wav",
 "1i4CO_MAtEKePqG3UpG31lL0JWy1cMM6X":"Anh Đau Từ Lúc Em Đi - MO.wav",
 "1klVxcudFX-6IMKKE37J-4HgmfpFAu5W_":"Ôm Em Được Không - MO.wav",
 "1pKAXDhrTMfz8ENUatgZkl53zOumNQrv_":"LK Hoang Mang - Ai Chờ Tình Chung - MO.wav",
 "10N-3HvZJAR_HhE0n6mznIMI6uxMzNsiU":"Vùng Trời Bình Yên - MO.wav",
 "1kuq-wFmOfdipoTOGyyDLXERU99gGnTWj":"LK Rất Lâu Rồi Mới Khóc - Ngày Mai Người Ta Lấy Chồng - MO.wav",
 "1VmOzO1rS-eRPzGVcPc3QKZbeEgXx__SR":"Hoa Và Váy (Rock Ballad).wav",
 "13RRilTdHEPBovSf0335Tocaq5AihFagb":"Liên Khúc Hoa - MO.wav",
 "1M8ajA6e4Q7OnCczijW2b8gJI7xH2Us1B":"Hoa Và Váy (R&B Live).wav",
 "1OsQeB2sqLEA-1rrCcNy_TR56l6c9kcHf":"Mashup Nơi Nào Có Em - Người Ta (Bè).wav",
 "10Ar0kY21iN6r9DH4qz0bZqQ7Tdmu0sKF":"Xin Chào (Remix).wav",
 "1e2kaKYmzpDi74zgRfeF4Uru8YQTLm0bd":"Sway (Bè).wav",
 "1Ji8B3Q6XpNEWo_WSbSjgnSNCn-LWGxlc":"Lặng - MO.wav",
 "1kFfYewC-j_LnoZTgPiRY5fPhRiGMlPCm":"Em Đã Thấy Mùa Xuân Chưa - MO.wav",
 "1jyqY3lbGyG9EluyxVbQ09gxZ2wtxmwrN":"Rất Lâu Rồi Mới Khóc - MO.wav",
 "1ePFBWCKEchcwYrHkvu8_Y_ezya-6Ap7H":"Lời Tỏ Tình Của Mùa Xuân - MO.wav",
 "1ODT3RKgRJ6VgkPyX_JeZ7EN24RDjYLA8":"Son - MO.wav",
 "1CG4kXu7XqD0AMTm9WXqBlxHsu1FP3GxU":"Thiếu Em Như Trái Đất Thiếu Mặt Trời - MO.wav",
 "1Kz6IU9Ywn2ESV4jPHmR03eXHDCefWRFP":"Hãy Để Anh Đi - MO.wav",
 "1pzO1ALQd1sH8XZNHB4tF_xHJdonq6uN3":"Đông Dịu Ngọt - MO.mp3",
 "1DWe54_Fdye0X03hwHCntW9QPI49C_L_x":"Vội Vàng - MO.mp3",
 "1StLivzU-ANI8am5ZTnct-5isGQOC6Kou":"Thiên Đường Gọi Tên - MO.mp3",
 "1pq66LKOZnw3hvDNRjQbxmDHYN5uHCJGs":"Tình Yêu Tôi Hát - MO.mp3",
 "1fV3VYX_w2GxQ0uJsA_SjNW1k9jHlqBUL":"Mashup Ngày Mai Người Ta Lấy Chồng - MO.wav",
 "11XTJd1hef3jJtmwxOcozdDhryt_70Oct":"Mình Yêu Nhau Từ Kiếp Nào - MO.mp3",
 "1FlHIISqvMz-nz-rfPwDWbr2riI05k2_C":"Đông Dịu Ngọt - MO (2).mp3",
 "1A63blIAvh7VJduqvTcH-3ZbL8zm8G9S4":"Mashup Mong Manh Tình Về - Khi Giấc Mơ Về - MO.mp3",
 "1htbNmI57og7h8xjGrL6fK4sDRyj6vhHQ":"Đừng Làm Trái Tim Anh Đau - MO.wav",
 "1BVhQYZyG-aQQcP5It9iqPieloRFeKEtg":"Một Đêm Say - MO.wav",
 "1vzyN5qjJhx-QIxiHevspoAFtdnaoubOv":"Mỗi Đêm Tôi Về - MO.wma",
 "1wunavQnZLXUBMyEPjcnxplj_qWM4GQzs":"Sau Tất Cả - MO.mp3",
 "1h7XdRWESWNZ7iOdPl1adIOYXVLF5RKMl":"Những Lời Dối Gian (Playback).mp3",
 "1rZG9pHdMc4s52czTmq-v64ztGxQccbWb":"Em Xa Theo Bình Yên - MO.mp3",
 "1LXic4h5TnYQucJBSevK_mihqxVEAbgPd":"Gió Cuốn Em Đi (Bè).wav",
 "1Xn0TFtBIlCmtdtTqImsryRn_b6bzWG0m":"Trái Tim Quả Cảm (Tone Nam).wav",
 "1ijXb1AQXRvJ1nFBuZFY1qG7ZZB4CZri_":"Mashup Hơn 1000 Năm Sau - MO.wav",
 "1n5dx4ycFlLCGaK14LlrznNVDy292ihOC":"Mong Manh Tình Về x Hạ Trắng (Melody).mp3",
 "17DBtNGYMelFGCvTRRbORkncjomakBCA8":"Mashup Người Yêu Ơi - Ngàn Năm Vẫn Đợi - MO.mp3",
 "1QytK0g7P2Zg5xSLsAmgE1w6pSE5LMinJ":"Một Ngàn Lý Do Đau Lòng (Bè).mp3",
 "1MRpP-9GSuo9A0BQVqk0WQjb3AnrNvpa3":"Một Vòng Việt Nam - MO.wav",
 "1t4zQHtlz3UUdKGqNgyIDpBG0TOdUR8ep":"Ngày Tân Hôn - MO.mp3",
 "1GquK0zlgxVIoJxrdFvFpRLkAFEKMTN2l":"Đà Lạt - Lặng (Playback).wav",
 "1_DGh4VKgEfJiD7t1iC0o-8ZSIyu38zfS":"Thiên Đường Tìm Đâu (Bè).mp3",
 "1PPXB7MQ4viJwpspvfx_oZ3FMcaFJKfbv":"Thì Thầm Mùa Xuân (Remix).mp3",
 "1Js-RTXC2Sb2J3Ae7SdujbbQnR6GXMmKL":"Trái Đất Ôm Mặt Trời (Mix).mp3",
 "10ic7VR1a4FQuesi111O0Qauld3MGxgF6":"Trời Vẫn Còn Xanh - MO.mp3",
 "1ZZaqAs9hdFYx2wmW-OsiDKoTK3DOxN5O":"Tự Dưng Thành Người Lạ - MO.wav",
 "16XYeOk4n9VKBVIvujeYh1mtpLOIOIhZE":"Và Tôi Cũng Yêu Em - MO.mp3",
 "1M1ipjwxfcuYYkKbPpmm2fldQPh9YPqYI":"Xin Chào Xin Chào - MO.wav",
 "1Bd3qcHvWYTb4TF0CceyLmaYDo__G_WBm":"LK Big Hits (Remix).wav",
 "1zgXgpSV6Y3dsBx3wi7jslIH8KVLee58Z":"Kẻ Say Tình (Bè).wav",
 "1IJFD5QIrur3lhgUSNq0xY9wk1Z27I1qk":"Nắng Có Còn Xuân (Beat 2).mp3",
 "1Piq2OB-3B6YOmif7Kd_4BVqyqVbff5W9":"Hoa Và Váy (R&B Live 2).wav",
 "1jJBJQrxKMuc-bV8OnonSja9MsZyuPaqV":"Triệu Đóa Hồng - MO.wav",
 "1DokFW1wBT1W_dNdU7W7MJ5NDphOJyIQS":"Ngày Mai Em Đi (Remix).aiff",
 "1q6R2tTA1uvm_Z3tIx4pYYVUKGSsaWKHP":"Kiếp Sau Vẫn Là Người Việt Nam (Bè).wav",
 "1wljLAxlWcRObct8pMWgnU8auYCMfVv_t":"Viết Tiếp Câu Chuyện Hòa Bình - MO.wav",
 "1gB6A5iS_8bDT6MgdjzrHJeq0lmQ-Hpz8":"Hơn 1 Nghìn Năm Sau (Bè).wav",
 "1ZnKAzXP0rWeH7xGSMpOeCQjevyBH8CQY":"Kẻ Say Tình (Bè 2).wav",
 "1DLwFwViskzNvdwYGkWQvJLOySi_GgSUE":"Skynote - MO.wav",
 "1fRqQDQ87deyblm4n8WM9cf8mOCqtpqDT":"Tình Thôi Xót Xa - MO.wav",
 "1lH4S_1EKRcqmZOA-TjBgzWNQtZHFEKnh":"Vạn Sự Tùy Duyên (Có Bè).wav",
 "19MuhRD0GUQTsJNgfFDivq-aHkiW3gf1W":"Mối Tình Không Tên - MO.wav",
 "1cxoo8idNPCs59r6xeekGMfYkwDUuEe4R":"Liên Khúc Hoa - MO (2).wav",
 "162O2LCV0_PruOshYv8G-hIVUwVmjxAhp":"Người Yêu Dấu Ơi (Playback).wav",
 "1-mX9JBnNs0LHzOulnxqb4jLOhLyFc9gS":"Ngày Mai Người Ta Lấy Chồng (Có Bè).wav",
 "18FadIMTXfimoxXkYGRTYXqOIjPBHwtFx":"Như Hoa Mùa Xuân - MO.wav",
 "1ggi722fvoNZTUMNAlhJtubw_8AohmnHd":"Hơn 1 Nghìn Năm Sau (Bè 2).wav",
 "1_9HeVoYhL-3v1t0xTUEMd55WQ3hx2Nvp":"Feliz Navidad - MO.wav",
 "1YHEYbRp_OKmcc80-HzqFsg6APn3BfmGk":"Tình Như Lá Bay Xa - MO.wav",
 "1FoVRpl7Ggj_RlZB2B2ySyltVoAkQI_l8":"Nhớ Về Em - MO.wav",
 "1rPgOsORpILoJKfRD2B-tQ8eI432caZNB":"Thương - MO.wav",
 "141K55LROeav467tL35j8XBAr7GLA0OxI":"Vùng Trời Bình Yên (Remake).wav",
 "1Bm4jn2VMvwMuwjJ5SsKntoxr4mutRMsC":"Người Yêu Dấu Ơi (Playback 2).wav",
 "1TkbGzDXBCVkVRz3GUCnDH4H9HtNAGsO_":"Phải Là Anh Thì Em Mới Biết - MO.wav",
 "1tKISOTkYpbWTppf5Tr8fcivuBEXSEs5o":"Vì Ta Quá Yêu - MO.mp3",
 "1h9rJaM3eLymZvFPlwgbhDPOJywdrwQpB":"Rồi Mai Tôi Đưa Em - MO.wav",
 "1G27vAhSk1yfx__lijPXQvM05L2VcztfU":"Trời Vẫn Còn Xanh - MO (2).mp3",
 "1xMiuXw3kv-3KUweLZIHwSw9IBgLdaagK":"Như Hoa Mùa Xuân - MO (2).wav"
};

function previewRename(){
  var n=0;
  for(var id in RENAME){
    try{ var f=DriveApp.getFileById(id); Logger.log((f.getName()===RENAME[id]?'(giữ) ':'ĐỔI  ')+f.getName()+'  →  '+RENAME[id]); n++; }
    catch(e){ Logger.log('❌ KHÔNG MỞ ĐƯỢC '+id+' : '+e); }
  }
  Logger.log('--- Tổng '+n+' file (xem kỹ rồi chạy applyRename) ---');
}

function applyRename(){
  var done=0, skip=0, err=0;
  for(var id in RENAME){
    try{
      var f=DriveApp.getFileById(id); var nn=RENAME[id];
      if(f.getName()===nn){ skip++; continue; }
      f.setName(nn); done++;
    }catch(e){ err++; Logger.log('❌ '+id+' : '+e); }
  }
  Logger.log('Xong: đổi '+done+', giữ nguyên '+skip+', lỗi '+err+'.');
  try{ SpreadsheetApp.getUi().alert('Đổi tên beat xong: '+done+' đổi, '+skip+' giữ, '+err+' lỗi.'); }catch(e){}
}
