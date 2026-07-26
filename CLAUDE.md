# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드 (lint + 타입체크 포함)
npm run lint       # eslint .
npm run typecheck  # tsc --noEmit
```

**테스트 프레임워크가 없습니다.** 순수 로직(DDL 생성, 병합, 정규화, 스토어 액션)을 검증할 때는
루트에 임시 `.ts` 스크립트를 쓰고 `npx tsx@4 scratch-xxx.ts` 로 실행한 뒤 **삭제**하는 방식을
써 왔습니다. tsx 는 `tsconfig.json` 의 `@/*` alias 를 그대로 해석합니다.

브라우저 자동화 도구가 없습니다. 드래그·마우스 상호작용은 코드만 보고 "동작한다"고 단정하지 말고,
확인하지 못했다는 점을 사용자에게 명시하세요. (과거에 이 단정 때문에 실제 버그를 놓쳤습니다.)

### git push

이 셸은 비대화형이라 git 이 자격증명 프롬프트를 띄우지 못하고 즉시 실패합니다. GCM 이 설치돼
있어도 마찬가지입니다. push 할 때는 환경변수를 붙이세요.

```powershell
$env:GIT_TERMINAL_PROMPT = "1"; $env:GCM_INTERACTIVE = "true"; git push
```

## 기획서

[ERD_Builder_기획서.md](ERD_Builder_기획서.md) 가 원본 스펙이며 Sprint 1~4 계획이 들어 있습니다.
현재 진행 상황은 [README.md](README.md) 하단에 있습니다. 새 기능은 스프린트 순서를 따르되,
기획서와 다르게 구현한 부분은 README 의 "설계 메모"에 이유를 적어 두는 것이 이 저장소의 관례입니다.

## 아키텍처

### 상태의 단일 진실 원천

`useERDStore` 가 `projects: ERDProject[]` + `currentProjectId` 를 들고, 활성 프로젝트는
`selectProject(state)` 로 **파생**합니다. 활성 프로젝트를 별도 필드로 복사해 두지 않기 때문에
목록과 편집 내용이 어긋날 수 없습니다. 모든 편집 액션은 `patchProject()` 헬퍼를 거칩니다.

> ⚠️ **zustand 셀렉터에서 `map`/`filter` 로 새 배열·새 객체를 만들어 돌려주지 마세요.**
> 매 호출마다 참조가 달라져 `useSyncExternalStore` 가 무한 루프로 판단하고 React 가 에러를 던집니다.
> `useShallow` 로도 못 막습니다(원소가 새 객체라서). `state.projects` 처럼 참조가 안정적인 값을
> 받아 컴포넌트에서 `useMemo` 로 가공하세요. 이미 두 번 밟은 함정입니다.

`moveTable` 은 드래그 중 매 프레임 호출되므로 **일부러 `updatedAt` 을 갱신하지 않습니다.**
그래서 "변경됨" 판정은 타임스탬프가 아니라 **객체 참조 비교**로 해야 합니다
(`useCloudSync` 의 `lastPushed` Map 참조).

### 파생 필드

`Column.isFK` 는 사용자가 직접 켜는 값이 아니라 **관계선에서 파생**됩니다. 관계가 바뀔 때마다
`syncFkFlags()` 가 전체 컬럼을 다시 계산합니다. SidePanel 의 FK 칩은 비활성 상태로 참조 대상만
보여줍니다. 이 불변식을 깨는 코드를 추가하지 마세요.

### store ↔ React Flow 브리지

`ERDCanvas.tsx` 한 곳에만 있습니다. 두 개의 `useEffect` 가 `tables`/`relations` 를 노드/엣지로
변환하고, 기존 노드 객체를 재활용해 React Flow 가 붙여 둔 `measured` 등을 잃지 않게 합니다.
드래그 위치는 `onNodesChange` 에서 스토어로 되돌려 씁니다.

관계선이 붙을 핸들(좌/우)은 저장하지 않고 **두 테이블의 x 좌표를 비교해 매번 고릅니다.**

### 컬럼 핸들 — 두 가지 함정

1. **핸들 ID 는 `` `${tableId}::${columnId}::${side}` ``** (`lib/handles.ts`).
   구분자가 `::` 인 이유, 그리고 `lib/ids.ts` 가 `customAlphabet` 으로 **영숫자 전용 ID** 를
   발급하는 이유는 nanoid 기본 알파벳에 `-`/`_` 가 있어 파싱이 깨지기 때문입니다.
2. **`TableNode` 루트에 `overflow-hidden` 을 걸면 안 됩니다.** 핸들은 노드 경계 바깥
   (`left/right: -5px`)에 놓이므로 잘려 보이지 않을 뿐 아니라 **포인터 이벤트까지 잘려 연결 자체가
   불가능해집니다.** 모서리 둥글리기는 첫/마지막 자식에 `rounded-t-[7px]`/`rounded-b-[7px]` 로
   직접 겁니다. 실제로 발생했던 버그입니다.

`ConnectionMode.Loose` 를 쓰므로 핸들 타입은 전부 `source` 이고, FK/PK 방향은 연결이 끝난 뒤
`connect()` 액션이 판단합니다 — **둘 중 정확히 한쪽만 PK 면 그쪽이 참조 대상**, 아니면 드래그를
시작한 쪽이 FK입니다.

### 영속화 3계층

```
useAutoSave(500ms) → LocalStorage   ← 항상 동작. 오프라인 캐시 겸 단독 저장소
useCloudSync(2s)   → Supabase       ← 로그인 시에만. localReady 이후에만 시작
```

`useCloudSync(localReady)` 의 인자는 필수입니다. LocalStorage 복원이 끝나기 전에 서버와 병합하면
로컬 작업물이 밀립니다. `ERDBuilder.tsx` 의 호출 순서를 바꾸지 마세요.

### 신뢰 경계

LocalStorage 저장본 · 업로드된 JSON · **Supabase 응답**이 모두 `normalizeProject()`
(`lib/project.ts`) 를 통과합니다. 형태가 아예 다르면 `null`, 일부만 깨졌으면(없는 테이블을
가리키는 관계, 모르는 타입) 그 부분만 버리고 나머지를 살립니다. 새 입력 경로를 추가하면 반드시
이 함수를 거치게 하세요.

### Supabase 는 선택 기능

`isSupabaseConfigured()` 가 `false` 면 로그인 UI 가 렌더되지 않고 middleware 는 no-op 이며
앱은 LocalStorage 전용으로 정상 동작합니다. **모든 진입점(미들웨어, 라우트 핸들러, 클라이언트
싱글턴, 훅)이 이 분기를 지켜야 합니다.** `getSupabaseClient()` 는 미설정 시 `null` 을 돌려주므로
호출부에서 반드시 분기하세요.

`projects.id` 는 uuid 가 아니라 **text** 입니다 — 로그인 전 브라우저에서 발급한 로컬 ID 를
그대로 올려 ID 재매핑 없이 병합하기 위해서입니다. ERD 전체는 `data jsonb` 한 컬럼에 통째로
들어갑니다(서버에서 ERD 내부를 조회할 일이 없음). 스키마는
[supabase/migrations/0001_projects.sql](supabase/migrations/0001_projects.sql), 권한은 RLS 가
전담하므로 애플리케이션 코드에 소유권 체크를 넣지 마세요.

동기화 충돌은 `update ... where id = ? and updated_at = ?` 가 0행을 갱신하는 것으로 감지하고,
서버 버전을 `'이름 (서버 버전)'` **별도 프로젝트로 보관**한 뒤 로컬을 올립니다. 자동 병합을
시도하지 않습니다.

### DDL 생성

`lib/ddl-generator.ts`. FK 참조 대상이 먼저 CREATE 되도록 Kahn 알고리즘으로 위상정렬하며,
자기 참조는 순서에 영향이 없으므로 의존성에서 제외합니다. **순환 참조가 있으면** 어떤 순서로도
인라인 FK 가 성립하지 않으므로 FK 를 전부 `ALTER TABLE ... ADD CONSTRAINT` 로 분리하고 경고를
반환합니다.

DBMS 차이는 `DIALECTS` 테이블(인용부호, 인라인 COMMENT 지원, IF NOT EXISTS 지원, named
constraint)로 흡수합니다. 새 DBMS 지원은 여기에 항목을 추가하는 일입니다.

### 타입 프리셋

`constants/column-types.ts` 가 **논리 타입(`ColumnType`) → 물리 타입** 매핑을 DBMS 별로 갖습니다
(MySQL `VARCHAR(255)` vs MSSQL `NVARCHAR(255)`). `formatColumnType()` 을 노드 렌더링과 DDL
생성기가 공유하므로, 타입 표시가 바뀌면 DDL 도 함께 바뀝니다.

## 관례

- 주석과 UI 문구는 한국어입니다.
- `lib/` 는 순수 함수, `hooks/` 는 상태·부수효과. 테스트 가능한 로직은 `lib/` 에 두세요
  (예: `mergeLibraries` 는 훅 안에 있다가 `lib/project.ts` 로 옮겼습니다).
- shadcn/ui 대신 `components/common/ui.tsx` 에 최소한의 프리미티브만 직접 두고 있습니다.
- 색은 전부 `app/globals.css` 의 CSS 변수입니다. 하드코딩하지 마세요 — 다크모드가 이 위에 얹힙니다.
- lucide-react v1 부터 브랜드 아이콘(`Github` 등)이 제거됐습니다. 아이콘 추가 전 존재 여부를
  확인하세요.
