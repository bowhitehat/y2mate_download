# Y2Downloader - Công cụ tải Video & Nhạc MP3 từ YouTube (Tương tự Y2Mate)

**Y2Downloader** là ứng dụng tải video và tách nhạc MP3 từ YouTube chạy trực tiếp trên máy tính của bạn, mô phỏng trải nghiệm tiện lợi của **y2mate** nhưng **hoàn toàn sạch sẽ, không quảng cáo, tốc độ cao không giới hạn**.

---

## ✨ Tính năng nổi bật

- 🎬 **Tải Video Đa độ phân giải**: Hỗ trợ 4K UHD (2160p), 2K (1440p), Full HD (1080p 60fps), HD (720p), 480p, 360p... Định dạng chuẩn `.mp4` tương thích mọi thiết bị (máy tính, điện thoại, smart TV).
- 🎵 **Chuyển đổi MP3 chất lượng cao**:
  - MP3 320 kbps (Chất lượng phòng thu, cực nét cho tai nghe/loa)
  - MP3 256 kbps & 192 kbps (Chuẩn âm thanh chất lượng cao)
  - MP3 128 kbps (Dung lượng nhẹ, tiết kiệm bộ nhớ)
- ⚡ **Audio gốc M4A/AAC**: Tải trực tiếp luồng âm thanh nguyên bản của YouTube chỉ trong vài giây không cần mã hóa lại.
- 🔍 **Tìm kiếm thông minh**: Hỗ trợ dán link video (YouTube thường, Shorts, YouTube Music) hoặc **gõ tên bài hát / ca sĩ** để tìm và chọn video trực tiếp ngay trên giao diện.
- 🛡️ **100% Sạch & An toàn**: Không chứa mã độc, không pop-up, không quảng cáo chuyển hướng khó chịu như các web tải online.
- 📁 **Quản lý file tiện lợi**: 
  - Tự động lưu vào thư mục `downloads/` của công cụ.
  - Tự động kích hoạt tải về trên trình duyệt (lưu thẳng vào thư mục `Downloads` của máy tính).
  - Nút 1-click mở nhanh thư mục lưu trữ trong Windows Explorer.
  - Nút phát thử file trực tiếp bằng trình nghe nhạc / xem video mặc định.
- 🌓 **Giao diện hiện đại**: Hỗ trợ cả chế độ Sáng (Light Mode) và Tối (Dark Mode), hiển thị phần trăm tiến trình tải và tốc độ theo thời gian thực.

---

## 🚀 Cách khởi động và sử dụng

### Cách 1: Khởi động nhanh bằng 1 click (Khuyên dùng)
Nhấp đúp chuột vào file:
```
start.bat
```
Cửa sổ màu xanh sẽ xuất hiện và trình duyệt web của bạn sẽ tự động mở trang:
`http://localhost:5000`

### Cách 2: Chạy bằng dòng lệnh Python
Mở Terminal / PowerShell tại thư mục này và chạy:
```bash
python run.py
```

---

## 📖 Hướng dẫn sử dụng

1. **Dán link hoặc tìm kiếm**:
   - Dán link YouTube bất kỳ (bấm nút **Dán** trên ô tìm kiếm).
   - Hoặc gõ tên bài hát (ví dụ: `Nơi này có anh Sơn Tùng` hoặc `nhạc lofi chill`) rồi nhấn Enter / bấm nút **Bắt đầu**.
2. **Chọn định dạng**:
   - Tab **Video (MP4)**: Chọn độ phân giải (1080p, 720p...) rồi nhấn **Tải về**.
   - Tab **Âm thanh (MP3)**: Chọn chất lượng (320kbps, 256kbps...) rồi nhấn **Tải MP3**.
   - Tab **Audio Gốc (M4A)**: Tải âm thanh gốc nguyên bản siêu tốc.
3. **Theo dõi tiến trình & nhận file**:
   - Cửa sổ tiến trình sẽ hiển thị tốc độ tải và phần trăm hoàn thành.
   - Khi hoàn tất, file sẽ tự động được lưu về máy và bạn có thể bấm **Mở xem file ngay** hoặc **Thư mục lưu file**.

---

## 🛠️ Cấu trúc thư mục

```
tai_nhactuyt/
├── app.py              # Server Flask backend xử lý API
├── downloader.py       # Engine xử lý YouTube bằng yt-dlp & FFmpeg
├── run.py              # Trình khởi động tự động mở trình duyệt
├── start.bat           # File nhấp đúp chạy trên Windows
├── requirements.txt    # Danh sách thư viện Python
├── downloads/          # Thư mục lưu trữ các file đã tải về
├── templates/
│   └── index.html      # Giao diện chính của ứng dụng
└── static/
    ├── css/style.css   # Giao diện hiện đại (Dark/Light mode)
    └── js/app.js       # Logic xử lý tìm kiếm, tải, tiến trình
```

---

## 💡 Xử lý sự cố thường gặp

- **Nếu không tải được hoặc báo lỗi mạng**: Đảm bảo máy tính có kết nối Internet bình thường.
- **Nếu muốn cập nhật phiên bản tải YouTube**: Chạy lệnh `pip install --upgrade yt-dlp` để luôn có giải thuật giải mã mới nhất từ YouTube.
- **Contact me: tranghoangbo92@gmail.com**

