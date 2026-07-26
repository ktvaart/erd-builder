# 프로젝트 개요

## 프로젝트명

**ERD Builder**

브라우저에서 테이블을 그리고, 컬럼을 연결하고, DDL을 뽑아내는 개발자용 ERD 설계 도구 (ERD Cloud의 경량 버전)

## 개발 목표

- 코드 없이 드래그만으로 테이블 설계
- PK/FK 관계를 시각적으로 연결
- 설계 결과를 즉시 SQL DDL로 변환
- 별도 설치 없이 웹에서 사용
- 로그인 없이 로컬에서 바로 사용 (LocalStorage)
- (v2) SQL Toolbox와 연동되는 생태계 구축

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) |
| 언어 | TypeScript |
| 다이어그램 엔진 | React Flow (reactflow) |
| 스타일링 | TailwindCSS |
| UI 컴포넌트 | shadcn/ui |
| 아이콘 | Lucide React |
| ID 생성 | nanoid |
| 자동 레이아웃 (v2) | dagre 또는 elkjs |
| 저장소 | LocalStorage (v1) → 추후 Supabase 고려 (v2) |
| 배포 | Vercel |

---

# 화면 구성

```
--------------------------------------------------
Header
  ERD Builder            [DBMS 선택 ▼]   [Export ▼]
--------------------------------------------------
Toolbar (좌측 고정 or 상단)
  [+ Table]  [Auto Layout]  [Save]  [Load]  [Clear]
--------------------------------------------------
Canvas (React Flow)

  ┌─────────────┐        ┌─────────────┐
  │ users    PK │        │ orders   PK │
  ├─────────────┤        ├─────────────┤
  │ id       PK │◄──────┤ user_id  FK │
  │ name        │        │ id       PK │
  │ email       │        │ amount      │
  └─────────────┘        └─────────────┘

  (드래그로 이동 / 컬럼 핸들로 관계선 연결)
--------------------------------------------------
사이드 패널 (테이블/컬럼 선택 시 우측에 표시)
  - 테이블명 수정
  - 컬럼 추가/삭제/타입 변경
  - PK/FK/NOT NULL/UNIQUE 체크박스
  - FK인 경우 참조 테이블.컬럼 선택
--------------------------------------------------
하단 Export 패널
  [DDL 생성] [JSON Export] [JSON Import] [이미지로 저장]
--------------------------------------------------
```

---

# 기능 목록

## 1. 테이블 관리 (핵심)

- 캔버스에 테이블 노드 추가 (`+ Table` 버튼 또는 캔버스 더블클릭)
- 테이블명 인라인 편집
- 테이블 삭제 (연결된 FK 관계선도 함께 정리)
- 테이블 색상/카테고리 태그 (선택 기능)
- 드래그로 자유 이동, 위치는 자동 저장

## 2. 컬럼 관리

- 컬럼 추가/삭제/순서 변경 (드래그 정렬)
- 컬럼별 속성
  - 이름
  - 데이터 타입 (INT, VARCHAR(n), TEXT, DATETIME, BOOLEAN 등 — DBMS별 프리셋 제공)
  - PK 여부
  - FK 여부
  - NOT NULL
  - UNIQUE
  - DEFAULT 값
  - 설명(comment)

## 3. 관계(FK) 연결 — 핵심 난이도

- 각 컬럼 row 좌/우에 React Flow `Handle` 배치
- 컬럼에서 다른 테이블 컬럼으로 드래그하면 FK 관계선 자동 생성
- 연결 시 자동으로 대상 컬럼에 FK 속성 부여, 타입 자동 일치(옵션)
- 관계선 클릭 시 관계 편집(1:1 / 1:N / N:M 카디널리티 표시, 삭제)
- 관계선 스타일: 실선(필수) / 점선(nullable FK)

## 4. DDL 생성

- 테이블/컬럼/PK/FK 정보를 기반으로 `CREATE TABLE` 문 자동 생성
- 지원 DBMS (v1: 1~2개로 시작 → 순차 확장)
  - v1: MySQL
  - v1: MSSQL
  - v2: PostgreSQL, Oracle, SQLite, MariaDB
- FK 제약조건(`FOREIGN KEY ... REFERENCES ...`) 포함 옵션
- 생성 순서 자동 정렬 (FK 참조 대상 테이블이 먼저 생성되도록 위상정렬)
- 생성된 DDL은 SQL Toolbox의 Formatter로 바로 넘겨서 포맷팅 가능하도록 연동 고려

## 5. JSON Export / Import

- 전체 ERD 구조(테이블, 컬럼, 관계, 좌표)를 JSON으로 다운로드
- JSON 파일 업로드 시 캔버스에 그대로 복원
- 팀원과 파일 공유 가능한 형태

## 6. 저장/불러오기 (LocalStorage)

- 자동 저장 (변경 시마다 debounce 저장)
- 여러 프로젝트(ERD 다이어그램) 목록 관리
- 프로젝트별 이름 지정, 삭제, 복제

## 7. 이미지로 저장 (선택)

- 캔버스를 PNG로 export (React Flow 자체 기능 `toPng` 활용)

## 8. Auto Layout (v2)

- 테이블이 많아질 때 `dagre`/`elkjs`로 자동 정렬 버튼 제공

## 9. SQL → ERD 역변환 (v2, 확장 가치 큼)

- 기존 DDL(CREATE TABLE 문)을 붙여넣으면 파싱해서 자동으로 ERD 생성
- SQL Toolbox의 parser 로직 재사용 가능 → 두 프로젝트 시너지

## 10. 다크모드

- Light / Dark / System 자동 대응

---

# 데이터 모델 (JSON 스키마)

```ts
// types/erd.ts

export type ColumnType =
  | "INT" | "BIGINT" | "VARCHAR" | "TEXT" | "DATETIME"
  | "DATE" | "BOOLEAN" | "DECIMAL" | "FLOAT" | "UUID";

export interface Column {
  id: string;            // nanoid
  name: string;
  type: ColumnType;
  length?: number;        // VARCHAR(50) 등
  isPK: boolean;
  isFK: boolean;
  notNull: boolean;
  unique: boolean;
  defaultValue?: string;
  comment?: string;
}

export interface TableData {
  id: string;
  name: string;
  columns: Column[];
  position: { x: number; y: number };
  color?: string;
}

export interface Relation {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;   // 참조하는 컬럼 (FK)
  targetTableId: string;
  targetColumnId: string;   // 참조되는 컬럼 (PK)
  cardinality: "1:1" | "1:N" | "N:M";
}

export interface ERDProject {
  id: string;
  name: string;
  dbms: "mysql" | "mssql" | "postgresql" | "oracle" | "sqlite" | "mariadb";
  tables: TableData[];
  relations: Relation[];
  updatedAt: string;
}
```

---

# 폴더 구조

```
src/
│
├── app/
│   ├── page.tsx              # 메인 캔버스 페이지
│   └── layout.tsx
│
├── components/
│   ├── erd/
│   │   ├── ERDCanvas.tsx     # React Flow 캔버스 래퍼
│   │   ├── TableNode.tsx     # 커스텀 테이블 노드 (컬럼별 Handle 포함)
│   │   ├── RelationEdge.tsx  # 커스텀 관계선
│   │   ├── Toolbar.tsx       # 상단/좌측 툴바
│   │   ├── SidePanel.tsx     # 테이블/컬럼 편집 패널
│   │   └── ExportPanel.tsx   # DDL/JSON export
│   └── common/
│
├── lib/
│   ├── ddl-generator.ts      # DBMS별 DDL 생성 로직
│   ├── storage.ts            # LocalStorage 저장/불러오기
│   ├── layout.ts             # 자동 레이아웃 (dagre 연동, v2)
│   └── ddl-parser.ts         # SQL → ERD 역변환 (v2)
│
├── types/
│   └── erd.ts
│
├── hooks/
│   ├── useERDStore.ts        # 상태 관리 (zustand 고려)
│   └── useAutoSave.ts
│
└── constants/
    └── column-types.ts       # DBMS별 타입 프리셋
```

---

# 개발 순서 (Sprint)

## Sprint 1 (MVP 핵심, 2~3일)
- [ ] Next.js 프로젝트 생성, React Flow 세팅
- [ ] 커스텀 TableNode 구현 (컬럼 리스트 렌더링)
- [ ] 테이블 추가/삭제
- [ ] 컬럼 추가/삭제/이름·타입 편집
- [ ] 컬럼별 Handle 배치 (좌/우)
- [ ] 드래그로 FK 관계선 연결
- [ ] PK 지정 UI

## Sprint 2
- [ ] 관계선 카디널리티 표시/편집
- [ ] 관계선 삭제
- [ ] DDL 생성 (MySQL 우선 1개 DBMS)
- [ ] JSON Export / Import
- [ ] LocalStorage 자동 저장/불러오기

## Sprint 3
- [ ] 다중 프로젝트 관리 (목록/이름변경/삭제)
- [ ] MSSQL DDL 지원 추가
- [ ] 다크모드
- [ ] PNG 이미지 export

## Sprint 4 (확장)
- [ ] Auto Layout (dagre)
- [ ] SQL → ERD 역변환 (DDL 붙여넣기)
- [ ] PostgreSQL/Oracle/SQLite/MariaDB DDL 지원
- [ ] SQL Toolbox 연동 (생성된 DDL을 Formatter로 바로 전달)

---

# MVP 우선순위 체크리스트

여기까지 구현하면 실사용 가능한 **ERD Builder v1.0**:

- ✅ 테이블 생성/삭제
- ✅ 컬럼 추가/삭제/타입 지정
- ✅ PK 지정
- ✅ 컬럼 단위 드래그로 FK 연결
- ✅ 관계선 삭제
- ✅ DDL 생성 (1개 DBMS)
- ✅ JSON Export/Import
- ✅ LocalStorage 저장/불러오기

이후 Auto Layout, SQL→ERD 역변환, 다중 DBMS, SQL Toolbox 연동으로 확장하면 두 프로젝트가 하나의 "SQL 개발자 도구 생태계"로 발전할 수 있음.

---

# 핵심 구현 난이도 참고사항 (Claude Code 작업 시 유의점)

1. **컬럼별 Handle**: React Flow의 `Handle` 컴포넌트를 컬럼 row 개수만큼 동적으로 렌더링해야 함. `id` prop에 `${tableId}-${columnId}-source` / `${tableId}-${columnId}-target` 형태로 고유값 부여 필요.
2. **DDL 생성 순서**: FK가 참조하는 테이블이 먼저 CREATE 되어야 하므로, 테이블 간 의존관계를 위상정렬(topological sort) 해서 순서를 정해야 함.
3. **타입 프리셋은 DBMS별로 분리**: MySQL의 `VARCHAR(255)`와 MSSQL의 `NVARCHAR(255)`처럼 이름이 다르므로 `constants/column-types.ts`에서 DBMS별 매핑 테이블을 따로 관리.
4. **상태 관리**: 테이블/컬럼/관계가 서로 얽혀있어 React state만으로는 복잡해지기 쉬움 → zustand 같은 경량 전역 상태 관리 도입 권장.
5. **LocalStorage 저장 시점**: 매 변경마다 즉시 저장하면 성능 저하 가능 → debounce(예: 500ms) 적용.
