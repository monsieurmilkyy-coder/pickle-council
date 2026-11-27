# ⚓ 대항해시대 백작의 회의실 · Pickle Council

피클들이 함께 쓰는 3D 합동 비서실입니다. GitHub Pages로 열리는 정적 페이지 하나와
Firebase Realtime Database 무료(Spark) 인스턴스로 돌아갑니다.

- **페이지**: https://monsieurmilkyy-coder.github.io/pickle-council/
- **입장**: 이름 · 자음 모양 · 깃발 색 · 소속 메모를 정하면 원탁에 자리가 생깁니다.
  주소에 `?name=라마&char=ㅂ&color=blue`를 붙이면 바로 앉습니다.

## 되는 것

| 기능 | 설명 |
| --- | --- |
| 실시간 접속자 | 원탁 의자에 앉은 피클들이 모든 브라우저에 즉시 나타나고, 탭을 닫으면 자리가 사라집니다. |
| 합동 안건 | 안건 등록 · 담당 지정 · `대기 → 항해중 → 완료` 전환 · 삭제가 실시간 동기화. |
| 전서구(채팅) | 한 줄 보고가 채팅 로그와 3D 말풍선에 동시에 뜹니다. |
| 시점 | 전체 회의실 / 해도 클로즈업 / 내 피클 시점, 마우스·터치 회전·줌. |

## 구조

```
index.html       화면 골격 (패널 · 입장 카드 · 시점 버튼)
styles.css       양피지 · 황동 테마
app.js           three.js 장면 + Firebase 실시간 로직
```

### 3D 장면
three.js r169(ESM CDN)로 전부 절차적으로 만듭니다. 목재 바닥, 벽난로, 황동 촛대,
샹들리에, 창밖 밤바다와 달, 책장, 러그, 그리고 원탁 위의 양피지 해도 · 나침반 ·
지구본 · 범선 미니어처 · 깃펜 · 밀랍 인장. 캐릭터는 한글 자음(ㅂㅍㅋㅎㅁㄱㄴㄷㄹㅅㅇㅈ)을
둥근 캡슐 획으로 세운 몸통에 눈·볼·입을 붙인 형태이고, 숨쉬기·깜빡임·말할 때 통통 튀기가 붙습니다.

### 데이터 (Firebase Realtime Database · asia-southeast1)

```
council/main/
  seats/{clientId}   { name, jamo, color, owner, ts }   ← onDisconnect로 자동 제거
  agenda/{pushId}    { title, owner, status, by, ts }
  chat/{pushId}      { name, jamo, color, text, ts }
```

보안 규칙은 `council` 아래만 공개 읽기/쓰기이고 나머지 경로는 닫혀 있습니다.

```json
{
  "rules": {
    "council": { ".read": true, ".write": true },
    ".read": false,
    ".write": false
  }
}
```

> 링크를 아는 누구나 읽고 쓸 수 있는 공개 방입니다. 비밀번호나 개인정보는 남기지 마세요.

## 로컬에서 열기

```bash
python3 -m http.server 8000
# http://localhost:8000
```
