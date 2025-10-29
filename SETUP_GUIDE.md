# 🚀 빠른 시작 가이드

이 가이드는 루틴 공유 웹 앱을 처음부터 끝까지 설정하는 방법을 단계별로 안내합니다.

## ⏱️ 예상 소요 시간: 15-20분

---

## 📋 사전 준비물

- Google 계정 (Firebase 사용)
- 웹 브라우저
- 텍스트 에디터 (VS Code 권장)
- Git (배포 시 필요)

---

## 🔥 Step 1: Firebase 프로젝트 생성 (5분)

### 1.1 Firebase Console 접속

1. [https://console.firebase.google.com/](https://console.firebase.google.com/) 접속
2. "프로젝트 추가" 또는 "Add project" 클릭
3. 프로젝트 이름 입력 (예: `routine-sharing`)
4. Google Analytics는 선택사항 (켜두면 사용 통계 확인 가능)
5. "프로젝트 만들기" 클릭

### 1.2 Authentication 설정

1. 왼쪽 메뉴에서 **"Authentication"** 클릭
2. "시작하기" 버튼 클릭
3. **"Sign-in method"** 탭 선택
4. "Anonymous" 찾아서 클릭
5. 스위치를 **"사용 설정"**으로 변경
6. "저장" 클릭

✅ 이제 익명 로그인이 활성화되었습니다!

### 1.3 Firestore Database 생성

1. 왼쪽 메뉴에서 **"Firestore Database"** 클릭
2. "데이터베이스 만들기" 클릭
3. 위치 선택:
   - 한국 사용자 대상: `asia-northeast3` (서울)
   - 기타: `us-central1`
4. 보안 규칙:
   - 처음엔 **"테스트 모드에서 시작"** 선택 (나중에 변경)
5. "사용 설정" 클릭

✅ Firestore 데이터베이스가 생성되었습니다!

### 1.4 웹 앱 등록 및 Config 가져오기

1. Firebase Console 홈으로 돌아가기
2. 프로젝트 개요 옆의 **⚙️ (톱니바퀴) 아이콘** 클릭
3. "프로젝트 설정" 선택
4. 아래로 스크롤하여 "내 앱" 섹션 찾기
5. **"</> (웹)" 아이콘** 클릭
6. 앱 닉네임 입력 (예: `routine-web`)
7. "Firebase Hosting 설정" 체크박스는 **체크하지 않음**
8. "앱 등록" 클릭
9. **Firebase SDK configuration 복사**

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxx"
};
```

📋 이 설정을 어딘가에 복사해두세요! (다음 단계에서 사용)

---

## 💻 Step 2: 프로젝트 설정 (3분)

### 2.1 Firebase Config 적용

1. 텍스트 에디터로 `firebase.js` 파일 열기
2. 다음 부분을 찾기:

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

3. Step 1.4에서 복사한 설정으로 **전체 교체**
4. 파일 저장

✅ Firebase 연결 완료!

---

## 🔒 Step 3: 보안 규칙 적용 (2분)

### 3.1 Firestore 보안 규칙 업데이트

1. Firebase Console에서 **"Firestore Database"** 선택
2. 상단 **"규칙"** 탭 클릭
3. 기존 내용을 모두 삭제
4. `firestore.rules` 파일의 내용을 전체 복사
5. Firebase Console 규칙 에디터에 붙여넣기
6. **"게시"** 버튼 클릭
7. 확인 창에서 "게시" 다시 클릭

✅ 보안 규칙 적용 완료! 이제 앱이 안전하게 보호됩니다.

**적용된 보안:**
- ✅ 읽기는 누구나 가능
- ✅ 쓰기는 인증된 사용자만
- ✅ 데이터 구조 검증
- ✅ 크기 제한 (10KB)
- ✅ 본인 작성 루틴만 삭제 가능

---

## 🧪 Step 4: 로컬 테스트 (5분)

### 4.1 웹 서버 실행

로컬에서 테스트하려면 웹 서버가 필요합니다 (Firebase는 CORS 제한 때문).

**방법 1: Python (권장)**
```bash
cd routine-sharing-web
python -m http.server 8000
```

**방법 2: Node.js**
```bash
npx http-server -p 8000
```

**방법 3: VS Code Live Server**
1. VS Code에서 `index.html` 파일 열기
2. 마우스 우클릭 → "Open with Live Server"

### 4.2 브라우저에서 확인

1. 브라우저에서 `http://localhost:8000` 접속
2. 개발자 도구 열기 (F12)
3. Console 탭에서 에러 확인
   - **정상**: "User signed in anonymously: [UID]" 메시지
   - **오류**: Firebase config 다시 확인

### 4.3 기능 테스트

**테스트 시나리오:**

1. **직접 입력으로 루틴 공유하기**
   - "공유하기" 탭 클릭
   - "직접 입력" 선택
   - 요일: 월요일
   - 시간대: 아침
   - 루틴:
     ```
     물 한 잔 마시기
     10분 스트레칭
     샤워하기
     아침 식사
     ```
   - "공유하기" 버튼 클릭
   - 미리보기 확인 후 "확인 및 업로드"

2. **둘러보기에서 확인**
   - "둘러보기" 탭 클릭
   - 방금 업로드한 루틴 카드 확인
   - 카드 클릭하여 상세 보기
   - ❤️ 좋아요 버튼 클릭

3. **필터링 테스트**
   - 요일 필터: "월요일" 선택
   - 시간대 필터: "아침" 선택
   - 결과 확인

✅ 모든 기능이 정상 작동하면 로컬 테스트 완료!

---

## 🌐 Step 5: 배포 (5분)

### Option A: GitHub Pages (무료)

#### 5.1 GitHub 저장소 생성

1. [GitHub.com](https://github.com) 접속 및 로그인
2. 오른쪽 상단 "+" → "New repository"
3. Repository 이름 입력 (예: `routine-sharing`)
4. Public 선택
5. "Create repository" 클릭

#### 5.2 코드 업로드

```bash
cd routine-sharing-web

# Git 초기화
git init
git add .
git commit -m "Initial commit: Routine Sharing Web App"

# GitHub에 연결 (주소는 본인 저장소로 변경)
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/routine-sharing.git
git push -u origin main
```

#### 5.3 GitHub Pages 활성화

1. GitHub 저장소 페이지에서 "Settings" 탭
2. 왼쪽 메뉴에서 "Pages" 선택
3. Source:
   - Branch: `main`
   - Folder: `/ (root)`
4. "Save" 클릭
5. 1-2분 후 페이지 새로고침
6. 상단에 배포된 URL 확인 (예: `https://your-username.github.io/routine-sharing/`)

✅ 배포 완료! 이제 전 세계 누구나 접속 가능합니다.

### Option B: Cloudflare Pages (무료, 더 빠름)

#### 5.1 Cloudflare Pages 설정

1. [Cloudflare Pages](https://pages.cloudflare.com/) 접속
2. "Create a project" 클릭
3. "Connect to Git" 선택
4. GitHub 연결 및 저장소 선택
5. 빌드 설정:
   - Framework preset: **None**
   - Build command: (비워두기)
   - Build output directory: `/`
6. "Save and Deploy" 클릭

✅ 자동 배포 완료! Cloudflare가 자동으로 HTTPS도 설정해줍니다.

**장점:**
- 더 빠른 로딩 (CDN)
- 자동 HTTPS
- 매 커밋마다 자동 재배포

---

## 🎉 완료!

축하합니다! 루틴 공유 웹 앱이 성공적으로 배포되었습니다.

### 다음 단계

1. **iOS 앱에서 테스트**
   - Habit Circuit 앱에서 루틴 내보내기
   - 웹에 업로드해보기

2. **커뮤니티에 공유**
   - 친구들에게 URL 공유
   - 피드백 받기

3. **모니터링**
   - Firebase Console에서 사용량 확인
   - Firestore Database에서 업로드된 루틴 확인

---

## 🐛 문제 해결

### "User not signed in" 에러
- Firebase Config가 올바른지 확인
- Authentication에서 Anonymous가 활성화되어 있는지 확인
- 브라우저 콘솔에서 JavaScript 에러 확인

### "Permission denied" 에러
- Firestore 보안 규칙이 올바르게 적용되었는지 확인
- Firebase Console → Firestore → Rules 탭에서 확인

### 업로드가 안 됨
- 브라우저 개발자 도구 → Network 탭에서 에러 확인
- Firebase Console → Firestore → Data 탭에서 직접 데이터 확인

### GitHub Pages에서 빈 페이지
- 저장소가 Public인지 확인
- Settings → Pages에서 URL 확인
- `index.html`이 루트 디렉토리에 있는지 확인

---

## 📞 추가 도움

- [Firebase 공식 문서](https://firebase.google.com/docs)
- [GitHub Pages 가이드](https://pages.github.com/)
- [Cloudflare Pages 문서](https://developers.cloudflare.com/pages/)

---

**Happy Sharing! 🚀**
