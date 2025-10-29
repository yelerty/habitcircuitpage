# 🔄 루틴 공유 커뮤니티 - Habit Circuit Web

Habit Circuit iOS 앱과 연동되는 루틴 공유 웹 플랫폼입니다. 사용자들이 자신의 일상 루틴을 익명으로 공유하고 다른 사람들의 루틴을 둘러볼 수 있습니다.

## 📋 주요 기능

- **익명 공유**: Firebase Anonymous Auth를 통한 가입 없는 루틴 공유
- **iOS 앱 호환**: Habit Circuit iOS 앱에서 내보낸 JSON 파일 직접 업로드 가능
- **필터링**: 요일, 시간대, 인기순/최신순 필터링
- **직접 입력**: 웹에서 직접 루틴 작성 및 공유
- **JSON 복사**: 마음에 드는 루틴을 JSON으로 복사하여 iOS 앱에서 가져오기

## 🏗️ 기술 스택

- **Frontend**: Vanilla JavaScript (ES6 Modules)
- **Backend**: Firebase (Serverless)
  - Firebase Authentication (Anonymous)
  - Cloud Firestore (Database)
- **Hosting**: GitHub Pages / Cloudflare Pages (권장)
- **UI**: 순수 CSS (iOS 디자인 언어 반영)

## 📊 데이터 구조

### Firestore Collection: `routines`

iOS 앱의 `RoutineExportData` 구조와 호환됩니다.

```json
{
  "version": "1.0",
  "dayOfWeek": "월요일",
  "timeType": "아침",
  "routines": [
    {
      "name": "물 한 잔 마시기",
      "order": 1
    },
    {
      "name": "10분 스트레칭",
      "order": 2
    }
  ],
  "anonId": "firebase_anonymous_uid",
  "createdAt": "Firestore Timestamp",
  "likes": 0,
  "metadata": {
    "platform": "Web",
    "uploadDate": "ISO8601 Date"
  }
}
```

## 🚀 설치 및 설정

### 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트 생성
2. **Authentication** 활성화:
   - Authentication → Sign-in method
   - "Anonymous" 활성화
3. **Firestore Database** 생성:
   - Firestore Database → Create database
   - 처음엔 "Test mode"로 시작 (나중에 보안 규칙 적용)
4. **웹 앱 추가**:
   - Project Settings → Your apps → Add app → Web
   - Firebase config 정보 복사

### 2. Firebase 설정 적용

`firebase.js` 파일을 열고 Firebase config를 교체하세요:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. Firestore 보안 규칙 적용

Firebase Console → Firestore Database → Rules 탭에서 `firestore.rules` 파일의 내용을 복사하여 적용하세요.

주요 보안 규칙:
- ✅ 누구나 읽기 가능 (공개 브라우징)
- ✅ 인증된 사용자만 작성 가능
- ✅ 본인이 작성한 루틴만 삭제 가능
- ✅ 좋아요만 업데이트 가능 (내용 수정 불가)
- ✅ 문서 크기 제한 (10KB)
- ✅ 루틴 개수 제한 (최대 20개)

### 4. 로컬 테스트

웹 서버를 실행하세요 (CORS 문제 해결을 위해 필요):

```bash
# Python 3
python -m http.server 8000

# 또는 Node.js (http-server)
npx http-server -p 8000
```

브라우저에서 `http://localhost:8000` 접속

### 5. 배포

#### GitHub Pages

```bash
# 1. GitHub 저장소 생성 및 코드 push
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/routine-sharing.git
git push -u origin main

# 2. GitHub Pages 활성화
# Repository Settings → Pages → Source: main branch
```

#### Cloudflare Pages

```bash
# 1. Cloudflare Pages 프로젝트 생성
# 2. GitHub 저장소 연결
# 3. 빌드 설정:
#    - Build command: (비워두기)
#    - Build output directory: /
#    - Root directory: /
```

## 📱 iOS 앱과의 연동

### iOS → Web 업로드

1. Habit Circuit iOS 앱에서 Settings → "루틴 내보내기"
2. JSON 파일 저장
3. 웹 사이트에서 "공유하기" → "파일 업로드"
4. 저장한 JSON 파일 업로드

### Web → iOS 가져오기

1. 웹에서 마음에 드는 루틴 카드 클릭
2. "JSON 복사하기" 버튼 클릭
3. iOS 앱에서 Settings → "루틴 가져오기"
4. 복사한 JSON 붙여넣기 (또는 파일로 저장 후 가져오기)

## 🔒 보안 및 제한사항

### Firebase 무료 티어 한도

| 서비스 | 무료 한도 | 예상 사용량 (MVP) |
|--------|-----------|------------------|
| Firestore 읽기 | 50,000/일 | ~10,000/일 |
| Firestore 쓰기 | 20,000/일 | ~500/일 |
| Anonymous Auth | 무제한 | 적합 |
| 저장공간 | 1GB | 충분 |

### 스팸 방지

현재 구현된 보안:
- Anonymous Auth 필수
- Firestore 보안 규칙로 데이터 검증
- 문서 크기 제한 (10KB)

추후 개선 필요:
- Cloud Functions로 Rate Limiting 구현
- 욕설 필터링
- 신고 기능

## 📂 프로젝트 구조

```
routine-sharing-web/
├── index.html          # 메인 HTML
├── style.css           # 스타일시트 (iOS 디자인 반영)
├── firebase.js         # Firebase 초기화 및 설정
├── app.js              # 메인 애플리케이션 로직
├── firestore.rules     # Firestore 보안 규칙
└── README.md           # 이 문서
```

## 🎨 디자인 시스템

iOS 앱의 디자인 언어를 반영했습니다:

### 시간대 색상

- 🌅 **아침 (morning)**: Orange (#FF9500)
- ☀️ **점심 (afternoon)**: Yellow (#FFCC00)
- 🌙 **저녁 (evening)**: Indigo (#5856D6)

### 반응형 디자인

- 데스크톱: 3열 그리드
- 태블릿: 2열 그리드
- 모바일: 1열 그리드

### 다크 모드

시스템 설정에 따라 자동으로 다크 모드 적용됩니다.

## 🐛 알려진 이슈 및 제한사항

1. **Real-time Rate Limiting 없음**: Cloud Functions 없이는 완벽한 Rate Limiting 불가
2. **오프라인 지원 없음**: 현재는 온라인 전용 (추후 Service Worker 추가 가능)
3. **이미지 업로드 없음**: 텍스트 기반 루틴만 지원
4. **검색 기능 미구현**: 추후 Algolia 또는 Firestore 쿼리로 구현 필요

## 🔮 향후 개선 계획

### Phase 2
- [ ] Cloud Functions로 Rate Limiting 구현
- [ ] 사용자 대시보드 (내가 올린 루틴 관리)
- [ ] 신고 기능
- [ ] 검색 기능

### Phase 3
- [ ] 루틴 카테고리/태그 시스템
- [ ] AI 기반 루틴 추천
- [ ] 다국어 지원 (영어, 일본어)
- [ ] 통계 및 인사이트

### Phase 4
- [ ] 루틴 템플릿 기능
- [ ] 커뮤니티 챌린지
- [ ] 소셜 공유 기능

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 🙋‍♂️ 문의 및 기여

이슈나 개선 제안은 GitHub Issues를 통해 제출해주세요.

---

**Made with ❤️ for Habit Circuit Community**
