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

### Cài đặt lần đầu

Cài Python, mở terminal trong thư mục dự án và chạy:

```bash
python -m pip install -r requirements.txt
```

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

### Nghe nhạc và playlist

Chạy `start.bat` sẽ tự mở giao diện nghe nhạc tại `http://localhost:5000/music`.
Trang gốc `/` cũng tự chuyển sang giao diện này. Bộ tải video nằm tại `/download`, mở qua menu **Bộ tải Video**.
Nếu cổng 5000 đang bận, dùng địa chỉ được in trong cửa sổ khởi động.

- Tìm theo tên bài hát, nghệ sĩ hoặc dán liên kết video YouTube.
- Nghe trực tiếp qua trình phát YouTube hiển thị trong ứng dụng; một số video có thể bị chủ sở hữu chặn nhúng, giới hạn khu vực hoặc yêu cầu mở trên YouTube.
- Trong **Nhạc trên máy**, nghe các tệp âm thanh có sẵn trong `downloads/` bằng trình duyệt, hỗ trợ tua khi định dạng tương thích.
- Tạo, đổi tên hoặc xóa playlist; thêm bài từ kết quả tìm kiếm hoặc thư viện; xóa bài và thay đổi thứ tự trong playlist.
- Dùng thanh phát để tạm dừng, chuyển bài, chỉnh âm lượng, phát ngẫu nhiên, lặp bài hoặc lặp hàng đợi.
- Playlist được lưu trong SQLite tại `data/music.sqlite3`, giữ lại sau khi khởi động lại. Sao lưu tệp này để giữ playlist. Dữ liệu cá nhân và nhạc đã tải không được đưa lên GitHub.
- Hàng đợi và thiết lập trình phát được lưu riêng trong trình duyệt. Trình duyệt có thể yêu cầu bạn bấm phát trước khi cho phép phát âm thanh.

Ứng dụng dùng thư viện chung trên máy, chưa có đăng nhập hoặc đồng bộ tài khoản. Khi dùng công cụ tải hiện có, chỉ tải nội dung bạn có quyền tải và tuân thủ điều khoản của nguồn cung cấp.

### Kết nối tài khoản YouTube

Trong menu **YouTube của tôi**, mở **Thiết lập Google lần đầu** và làm theo hướng dẫn có sẵn:

1. Tạo/chọn một dự án trong [Google Cloud](https://console.cloud.google.com/apis/library/youtube.googleapis.com) và bật **YouTube Data API v3**.
2. Mở **Google Auth Platform**: điền Branding; ở Audience chọn External/Testing và thêm email của bạn vào Test users; thêm scope `https://www.googleapis.com/auth/youtube.readonly` trong Data Access.
3. Vào **Clients → Create client → Desktop app**, rồi tải file OAuth Client JSON. Không dùng API key hoặc file Web application.
4. Chọn file JSON trong Y2Music, bấm **Kết nối Google** và tự đăng nhập/cấp quyền trên trang Google bằng trình duyệt thông thường như Brave hoặc Chrome.
5. Xem playlist của kênh đã chọn, mở playlist và bấm phát. Với danh sách dài, dùng nút **Xem thêm playlist** hoặc **Tải thêm bài trong playlist**. Nút phát chỉ phát những bài đang được hiển thị.

Tính năng dùng [OAuth cho desktop](https://developers.google.com/identity/protocols/oauth2/native-app) với PKCE và quyền chỉ đọc. Không cần nhập mật khẩu Google vào Y2Music. Google Cloud phải được thiết lập trước khi có thể đăng nhập; kiểm thử tự động dùng phản hồi Google giả lập, không thay thế kiểm tra với tài khoản thực.

Theo [YouTube Data API](https://developers.google.com/youtube/data/reference/rest/v3/playlists/list), danh sách tự động gồm playlist do kênh của bạn sở hữu; Y2Music cũng hiển thị video đã thích khi API cung cấp. Playlist của người khác bạn đã lưu có thể mở bằng liên kết nếu tài khoản có quyền xem. Xem sau, lịch sử, mix và một số nội dung riêng của YouTube Music không được API hỗ trợ đầy đủ. Video riêng tư hoặc chặn nhúng có thể cần mở trực tiếp trên YouTube.

Thông tin tài khoản nằm trong `data/youtube.sqlite3`, được bỏ qua trong Git. Trên Windows, cấu hình và token được mã hóa bằng DPAPI theo tài khoản Windows; không sao chép cơ sở dữ liệu này sang máy/tài khoản Windows khác để dùng phiên đăng nhập. Trên hệ POSIX, tệp dùng quyền truy cập `0600`. Không đăng file OAuth JSON hay token lên GitHub hoặc gửi qua chat. Dùng nút **Ngắt kết nối** để xóa phiên trên máy và yêu cầu Google thu hồi quyền; có thể xem quyền ứng dụng tại [Tài khoản Google](https://myaccount.google.com/connections).

Mỗi bản chạy trên máy dùng chung một tài khoản YouTube đã kết nối; đây chưa phải hệ thống nhiều người dùng. Chỉ các yêu cầu từ máy local và đúng trang ứng dụng được truy cập API tài khoản. Playlist gốc trên YouTube không bị chỉnh sửa.

### Tải video và âm thanh

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
├── music.py            # API thư viện nhạc và playlist SQLite
├── data/               # Dữ liệu playlist riêng trên máy (bỏ qua trong Git)
├── run.py              # Trình khởi động tự động mở trình duyệt
├── start.bat           # File nhấp đúp chạy trên Windows
├── requirements.txt    # Danh sách thư viện Python
├── downloads/          # Thư mục lưu trữ các file đã tải về
├── templates/
│   ├── index.html      # Giao diện chính của ứng dụng
│   └── music.html      # Giao diện nghe nhạc và playlist
└── static/
    ├── css/
    │   ├── style.css   # Giao diện trang tải nhạc
    │   └── music.css   # Giao diện thư viện và playlist
    └── js/
        ├── app.js      # Tìm kiếm, tải và tiến trình tải
        └── music.js    # Trình phát nhạc và quản lý playlist
```

---

## 💡 Xử lý sự cố thường gặp

- **Nếu không tải được hoặc báo lỗi mạng**: Đảm bảo máy tính có kết nối Internet bình thường.
- **Nếu muốn cập nhật phiên bản tải YouTube**: Chạy lệnh `pip install --upgrade yt-dlp` để luôn có giải thuật giải mã mới nhất từ YouTube.
- **Contact me: tranghoangbo92@gmail.com**

## Kiểm thử

```bash
python -m unittest discover -s tests -v
node --test tests/music_player.test.cjs
```

Các bài kiểm thử API dùng cơ sở dữ liệu và thư mục tạm riêng, không sửa playlist hay nhạc đang có trên máy.
