# ERD Builder

브라우저에서 테이블을 그리고, 컬럼을 연결하고, DDL을 뽑아내는 개발자용 ERD 설계 도구.

기획서: [ERD_Builder_기획서.md](ERD_Builder_기획서.md)

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

로그인 없이 바로 쓸 수 있습니다. 작업 내용은 LocalStorage에 자동 저장됩니다.

## 로그인 / 클라우드 동기화 (선택)

**환경변수를 넣지 않으면 로그인 UI가 아예 렌더되지 않고 LocalStorage 전용으로 동작합니다.**
계정을 붙이면 여러 기기에서 같은 ERD를 열 수 있습니다.

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. **SQL Editor** 에 [supabase/migrations/0001_projects.sql](supabase/migrations/0001_projects.sql) 붙여넣고 실행
3. **Authentication > Providers > GitHub** 활성화
   - GitHub OAuth App 의 callback URL: `https://<프로젝트>.supabase.co/auth/v1/callback`
4. **Authentication > URL Configuration > Redirect URLs** 에 추가
   - `http://localhost:3000/auth/callback`
   - 배포 주소가 있다면 `https://<도메인>/auth/callback`
5. `.env.local` 작성 ([.env.example](.env.example) 참고)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

`anon key` 는 클라이언트에 노출되어도 되는 공개 키입니다. RLS가 켜져 있어 남의 행에는
접근할 수 없습니다. `service_role` 키는 쓰지 않습니다.

## 기술 스택

| 영역 | 사용 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) |
| React | 19 |
| 언어 | TypeScript |
| 다이어그램 | `@xyflow/react` v12 (React Flow) |
| 상태 관리 | zustand |
| 스타일 | TailwindCSS v4 |
| 아이콘 | lucide-react |
| ID | nanoid |

기획서의 `reactflow`(v11) 대신 후속 패키지인 **`@xyflow/react`(v12)** 를 사용했습니다.
v11 은 React 19 를 지원하지 않습니다. API 는 거의 동일합니다.

UI 컴포넌트는 shadcn/ui 대신 [src/components/common/ui.tsx](src/components/common/ui.tsx) 에
필요한 최소한(Button / Input / Select / ToggleChip)만 직접 두었습니다. 노드 안에 들어가는
아주 작은 컨트롤이 대부분이라 별도 의존성을 두지 않는 편이 가볍습니다.

## 사용법

| 동작 | 방법 |
|---|---|
| 테이블 추가 | 툴바 `테이블 추가` 또는 **빈 캔버스 더블클릭** |
| 테이블 이름 변경 | 노드 헤더 **더블클릭** 또는 우측 패널 |
| 컬럼 추가 | 노드 하단 `컬럼 추가` 또는 우측 패널 `추가` |
| 컬럼 선택/편집 | 노드의 컬럼 클릭 → 우측 패널에서 편집 |
| FK 연결 | 컬럼 좌/우의 **점을 다른 테이블 컬럼으로 드래그** |
| 관계 편집/삭제 | 관계선 클릭 → 우측 패널 |
| 삭제 | 선택 후 `Delete` / `Backspace` |
| DDL / JSON | 헤더 `Export` → 하단 패널 |
| 프로젝트 전환 | 헤더 `프로젝트` → 목록에서 선택 |

작업 내용은 **LocalStorage에 자동 저장**됩니다 (마지막 변경 후 500ms debounce).
새로고침하면 그대로 복원됩니다. 로그인하면 2초 debounce로 서버에도 올라갑니다.

## 폴더 구조

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css        # 테마 변수 + React Flow 오버라이드
├── components/
│   ├── common/ui.tsx      # Button / Input / Select / ToggleChip
│   └── erd/
│       ├── ERDBuilder.tsx # 전체 레이아웃 + ReactFlowProvider
│       ├── Header.tsx     # 프로젝트명, DBMS 선택
│       ├── Toolbar.tsx    # 테이블 추가 / 화면 맞춤 / 전체 삭제
│       ├── ERDCanvas.tsx  # store ↔ React Flow 브리지
│       ├── TableNode.tsx  # 커스텀 테이블 노드 (컬럼별 Handle)
│       ├── RelationEdge.tsx
│       ├── SidePanel.tsx  # 테이블/컬럼/관계 편집
│       ├── ExportPanel.tsx # DDL / JSON 하단 패널
│       ├── ProjectMenu.tsx # 프로젝트 목록/생성/복제/삭제
│       └── AccountMenu.tsx # 로그인 · 동기화 상태
├── constants/column-types.ts  # DBMS별 타입 매핑
├── hooks/
│   ├── useERDStore.ts     # zustand 도메인 스토어 (projects[] + currentProjectId)
│   ├── useUIStore.ts      # 패널 열림 / 저장 · 동기화 상태
│   ├── useAutoSave.ts     # LocalStorage 복원 + debounce 저장
│   ├── useAuth.ts         # Supabase 세션
│   └── useCloudSync.ts    # 서버 병합 · 푸시 · 충돌 처리
├── lib/
│   ├── ddl-generator.ts   # DBMS별 DDL 생성 + 위상정렬
│   ├── project.ts         # 프로젝트 생성/복제/병합/정규화 (순수 함수)
│   ├── storage.ts         # LocalStorage 라이브러리 (v1 → v2 마이그레이션)
│   ├── supabase/          # client · server · config · projects CRUD
│   ├── handles.ts         # 핸들 ID 조합/파싱
│   ├── ids.ts
│   └── utils.ts
├── middleware.ts          # Supabase 세션 갱신 (미설정 시 no-op)
├── app/auth/callback/     # OAuth 코드 교환
└── types/erd.ts
```

## 설계 메모

**컬럼별 핸들.** 컬럼 row 마다 좌/우 두 개의 핸들을 두고, ID 는
`` `${tableId}::${columnId}::${side}` `` 형태로 만듭니다([src/lib/handles.ts](src/lib/handles.ts)).
nanoid 기본 알파벳에는 `-` 가 포함돼 파싱이 깨지므로 영숫자 전용 알파벳을 씁니다.
`ConnectionMode.Loose` 를 쓰기 때문에 source/target 핸들을 따로 둘 필요 없이
어느 쪽에서 끌어도 연결됩니다.

**FK 방향.** 두 컬럼 중 정확히 한쪽만 PK 면 그쪽을 참조 대상으로 보고, 반대쪽을 FK 로
잡습니다. 그 외에는 드래그를 시작한 쪽이 FK 입니다. 연결되면 FK 컬럼 타입이 참조 대상
타입으로 자동 정렬됩니다.

**`isFK` 는 파생값.** 관계선에서 계산되므로 사이드 패널에서 직접 토글할 수 없습니다.
관계가 바뀔 때마다 `syncFkFlags()` 가 전체 컬럼의 `isFK` 를 다시 계산합니다.

**관계선 렌더링.** 두 테이블의 x 좌표를 비교해 마주보는 쪽 핸들을 골라 선을 그립니다.
FK 가 nullable 이면 점선, NOT NULL 이면 실선입니다.

**타입 프리셋.** MySQL `VARCHAR(255)` / MSSQL `NVARCHAR(255)` 처럼 물리 타입 이름이
다르므로 [src/constants/column-types.ts](src/constants/column-types.ts) 에서 DBMS별로 분리
관리합니다. `formatColumnType()` 은 노드 렌더링과 DDL 생성기가 공유합니다.

**DDL 생성 순서.** FK가 참조하는 테이블이 먼저 CREATE 되도록 Kahn 알고리즘으로 위상정렬합니다
([src/lib/ddl-generator.ts](src/lib/ddl-generator.ts)). 자기 참조는 순서에 영향이 없으므로
의존성에서 제외합니다. 테이블 간 **순환 참조**가 있으면 어떤 순서로도 인라인 FK가 성립하지
않으므로, FK를 전부 `ALTER TABLE ... ADD CONSTRAINT` 로 분리해 항상 실행 가능한 스크립트를
만들고 경고를 띄웁니다.

**신뢰할 수 없는 입력.** LocalStorage 저장본, 업로드된 JSON, **서버 응답**이 모두 같은
`normalizeProject()` 를 거칩니다. 형태가 아예 다르면 거부하고, 일부만 깨졌으면(없는 테이블을
가리키는 관계, 모르는 타입 등) 그 부분만 버리고 나머지를 살립니다.

**단일 진실 원천.** 스토어는 `projects[]` + `currentProjectId` 를 들고 활성 프로젝트는
`selectProject(state)` 로 파생합니다. 활성 프로젝트를 따로 복사해 두지 않으므로 목록과
편집 내용이 어긋날 수 없습니다.

> ⚠️ zustand 셀렉터에서 `map`/`filter` 로 **새 배열을 만들어 돌려주면 안 됩니다.**
> 매 호출마다 참조가 달라져 `useSyncExternalStore` 가 무한 루프로 판단합니다.
> `state.projects`(참조 안정)를 받아 컴포넌트에서 `useMemo` 로 가공하세요.

**클라우드 동기화.** JSONB 한 컬럼에 `ERDProject` 를 통째로 넣습니다. 서버에서 ERD 내부를
조회할 일이 없는데 테이블/컬럼/관계로 쪼개면 편집 한 번에 여러 테이블 write 가 나가고
동기화가 복잡해지기만 합니다. `projects.id` 를 uuid 가 아니라 **text** 로 둔 것도 의도적입니다 —
로그인 전 브라우저에서 발급한 ID 를 그대로 올려 ID 재매핑 없이 병합하기 위해서입니다.

- **로그인 직후**: 서버 목록을 받아 로컬과 병합합니다(`mergeLibraries`). 같은 ID 는 `updatedAt`
  이 최신인 쪽을 채택하고, 한쪽에만 있는 건 둘 다 살립니다. **어느 쪽도 버리지 않습니다.**
- **덮어쓰기 방지**: `update ... where id = ? and updated_at = ?` 로 낙관적 동시성을 겁니다.
  0행이 갱신되면 다른 탭/기기가 먼저 저장한 것입니다.
- **충돌 시**: 서버 버전을 `'이름 (서버 버전)'` 이라는 **별도 프로젝트로 보관**한 뒤 로컬 버전을
  올립니다. 자동 병합을 시도하지 않고 둘 다 남겨 사용자가 직접 정리하게 합니다.

## 다음에 할 일

> 2026-07-26 기준. 작업을 이어서 시작할 때 여기부터 읽으세요.

### 1. 미검증 — 먼저 확인할 것

**Supabase 로그인·동기화는 코드를 작성만 했고 한 번도 실행해보지 못했습니다.**
타입체크·lint·빌드만 통과한 상태입니다. 환경변수가 없어 로컬 전용 경로로만 돌려봤습니다.

위 "로그인 / 클라우드 동기화 (선택)" 절을 따라 `.env.local` 을 만든 뒤 이 순서로 확인하세요.

1. 로그인 버튼이 헤더에 나타나는가 (env 없으면 안 나타나는 게 정상)
2. GitHub 로그인 → `/auth/callback` 리다이렉트가 성공하는가
3. 프로젝트를 만들면 Supabase `projects` 테이블에 행이 생기는가
4. 다른 브라우저(또는 시크릿 창)에서 같은 계정으로 로그인하면 그 프로젝트가 보이는가
5. 양쪽에서 동시에 수정 → 한쪽에 `'이름 (서버 버전)'` 프로젝트가 생기는가 (충돌 처리)

브라우저 자동화 도구가 없어 **드래그로 FK 연결하는 동작도 자동 검증은 못 했습니다.**
(사람이 눌러본 결과 정상 동작 확인됨)

### 2. 남은 기능

Sprint 3 의 다크모드 · PNG export 가 다음 순서입니다. 아래 체크리스트 참고.

### 3. 개발 환경 메모

- GitHub: https://github.com/ktvaart/erd-builder (private)
- Git Credential Manager 2.9.1 설치 완료. 이후 `git push` 는 그냥 됩니다.

---

## 진행 상황

### Sprint 1 — 완료
- [x] Next.js 프로젝트 생성, React Flow 세팅
- [x] 커스텀 TableNode 구현 (컬럼 리스트 렌더링)
- [x] 테이블 추가/삭제
- [x] 컬럼 추가/삭제/이름·타입 편집
- [x] 컬럼별 Handle 배치 (좌/우)
- [x] 드래그로 FK 관계선 연결
- [x] PK 지정 UI

### Sprint 2 — 완료
- [x] 관계선 카디널리티 표시/편집 (1:1 / 1:N / N:M)
- [x] 관계선 삭제
- [x] DDL 생성 — MySQL / MSSQL, FK 옵션 · 주석 · IF NOT EXISTS · 식별자 인용
- [x] JSON Export / Import
- [x] LocalStorage 자동 저장/불러오기 (500ms debounce + beforeunload flush)

추가로 들어간 것: 컬럼 순서 변경, NOT NULL / UNIQUE / DEFAULT / COMMENT 편집,
테이블 색상, DBMS별 타입 프리셋, 미니맵, 저장 상태 표시.

### Sprint 3 — 진행 중
- [x] 다중 프로젝트 관리 (목록/열기/이름변경/복제/삭제)
- [x] 로그인 + 클라우드 동기화 (Supabase, 기획서상 v2 항목을 앞당김)
- [ ] 다크모드 — 색은 전부 `globals.css` 의 CSS 변수라 `.dark` 블록만 추가하면 됩니다
- [ ] PNG 이미지 export (`toPng`)

### Sprint 4 — 예정
- [ ] Auto Layout (dagre)
- [ ] SQL → ERD 역변환
- [ ] PostgreSQL / Oracle / SQLite / MariaDB DDL 지원
      (타입 매핑과 dialect 설정은 이미 6종 모두 들어가 있고, UI에서만 v2로 표시 중)
- [ ] SQL Toolbox 연동
