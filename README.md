# 📅 Todo Master Pro - 실시간 일정 관리 통합 플랫폼
> **2025-2학기 초급프로젝트 Term Project 최종 제출**
> **React(Web)와 React Native(App)가 완벽하게 연동되는 하이브리드 일정 관리 서비스**

---

## 1. 프로젝트 개요 (Project Overview)
* **프로젝트명:** Todo Master Pro
* **개발자:** 전북대학교 IT정보공학과 최우성 (학번: 202118051)
* **목표:**
    1. 웹과 모바일 환경에서 동일한 사용자 경험(UX)을 제공하는 크로스 플랫폼 서비스 구축.
    2. Firebase Firestore를 활용하여 **1초 미만의 실시간 데이터 동기화** 구현.
    3. 낙관적 업데이트(Optimistic UI)를 적용하여 **즉각적인 반응 속도** 확보.

## 2. 사용 기술 스택 (Tech Stack)
| 분류 | 기술 | 설명 |
| :-- | :-- | :-- |
| **Front-End** | **React.js** | 컴포넌트 기반의 웹 애플리케이션 구축 및 상태 관리 |
| **Mobile** | **React Native (Expo)** | Android/iOS 모바일 앱 개발 (구글 로그인 UI 구현) |
| **Database** | **Firebase Firestore** | NoSQL 기반의 실시간 데이터베이스 및 쿼리 최적화 |
| **Auth** | **Firebase Auth** | 이메일 인증 및 소셜 로그인(Google) 연동 구현 |
| **Deployment** | **JCloud** | 웹 애플리케이션 정적 배포 (OpenStack) |
| **Design** | **CSS3 / Flexbox** | 반응형 레이아웃 및 3D Flip 애니메이션 구현 |

---

## 3. 핵심 기능 및 기술적 차별점 (Key Features)

### 1. 강력한 실시간 동기화 (Real-time Sync)
* 웹에서 일정을 추가하거나 수정하면, 별도의 **새로고침 없이 모바일 앱에도 즉시 반영**됩니다.
* `onSnapshot` 리스너를 최적화하여 데이터 변경 감지 속도를 극대화했습니다.

### 2. 낙관적 업데이트 (Optimistic Updates) 적용
* **기술적 챌린지:** 서버 응답을 기다리면 UI가 느리게 반응하는 문제를 해결했습니다.
* **해결:** 사용자가 버튼(완료, 삭제)을 누르는 순간 **화면(UI)을 먼저 갱신**하고, 백그라운드에서 DB 작업을 처리하여 **딜레이 없는 사용자 경험**을 제공합니다.

### 3. 고급 UI/UX 애니메이션 (Web & App)
* **Web/App 공통:** 로그인/회원가입 전환 시 **3D Transform(RotateY)**을 이용한 카드 뒤집기(Flip) 효과를 구현하여 시각적 완성도를 높였습니다.
* **Mobile:** 구글 로그인(Google Login) 버튼 UI를 배치하고, 직관적인 모달(Modal) 인터페이스를 적용했습니다.

### 4. 고도화된 일정 관리 (Advanced Todo)
단순한 할 일 관리를 넘어, 상용 캘린더 수준의 기능을 제공합니다.
* **상세 정보:** 장소, 참석자, 메모, 첨부파일 기능
* **설정 기능:** 반복 일정, 알림 시간 설정, 카테고리 분류(업무/공부 등), 중요도 설정

### 5. Google 로그인 토큰 이슈 해결
* **문제 상황:** Expo 환경에서 Google 로그인 시도 시, 일부 환경에서 `id_token`이 반환되지 않아 로그인이 멈추는 치명적인 오류 발생.

* **원인 분석:** Google Auth Session의 응답 객체(`response`) 분석 결과, `id_token` 대신 `access_token`만 포함되어 오는 경우가 있음을 확인.

* **해결 방법:** 1. 로그인 응답 처리 로직에 분기문을 추가하여 `access_token` 존재 여부를 확인.
    2. `id_token` 부재 시, `access_token`을 사용하여 **Google User Info API**(`https://www.googleapis.com/userinfo/v2/me`)를 직접 호출.
    3. 받아온 사용자 정보를 이용해 강제로 로그인 상태를 업데이트(`setUser`)하는 로직을 구현하여 **로그인 성공률 100% 달성**.

---

## 4. 폴더 구조 (Directory Structure)
본 리포지토리는 웹과 모바일 프로젝트를 통합하여 관리합니다.

```bash
TodoMaster-TermProject/
├── web-app/            # [Web] React.js 프로젝트 소스코드
│   ├── src/
│   │   ├── App.js      # 웹 메인 로직 및 Firebase 연동
│   │   ├── App.css     # 3D 애니메이션 및 반응형 스타일
│   │   └── ...
│   └── package.json
│
└── mobile-app/         # [Mobile] React Native Expo 프로젝트 소스코드
    ├── assets/         # 앱 아이콘 및 리소스
    ├── App.js          # 모바일 메인 로직 및 구글 로그인 UI
    └── package.json

설치 및 실행 가이드

1. Web Application 실행 (웹)
터미널을 열고 web 폴더로 이동합니다.

cd web-app
필요한 라이브러리를 설치합니다.

npm install
프로젝트를 실행합니다. (자동으로 브라우저가 열립니다)

npm start
접속 주소: http://localhost:3000

2. Mobile Application 실행 (모바일)
새 터미널을 열고 mobile 폴더로 이동합니다.

cd mobile-app
필요한 라이브러리를 설치합니다.

npm install
Expo를 실행합니다.

npx expo start
터미널에 표시된 QR 코드를 휴대폰의 'Expo Go' 앱으로 스캔하여 실행합니다.

본 웹 애플리케이션은 학교 클라우드 서버(OpenStack)에 배포되어 있으며, 아래 주소를 통해 언제든 접속할 수 있습니다.

배포 URL: http://113.198.66.75.nip.io:13066

테스트 계정: 별도의 회원가입 없이 Google 계정 로그인을 통해 즉시 테스트 가능합니다.

[서버 재실행 방법] 서버는 상시 가동 중이나, 만약 접속이 되지 않을 경우 아래 절차에 따라 서버를 재실행할 수 있습니다.

1) SSH 접속 (Xshell 또는 터미널)

Host: 113.198.66.75

Port: 19066

User: ubuntu

Password: 1234

Bash

ssh ubuntu@113.198.66.75 -p 19066

2) 무중단 배포 실행 (Screen 사용) 터미널 접속 후 아래 명령어를 순서대로 입력합니다.

Bash

# 1. 가상 터미널 생성
screen -S myweb

# 2. 프로젝트 폴더로 이동
cd TermProject/web-app

# 3. 서버 실행 (관리자 권한)
sudo npx serve -s build -l 3000
3) 실행 유지 및 종료

서버가 정상적으로 실행되면 키보드의 Ctrl + A, D를 순서대로 눌러 가상 터미널을 분리합니다. 

깃허브 주소: https://github.com/cws1513/TermProject