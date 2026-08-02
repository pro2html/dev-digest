# Спецификация: Skills для рев'ю-агентів

Статус: draft · Пакеты: `server/`, `client/`, `reviewer-core/` (только чтение) ·
Один документ на всю фичу.

## 1. Зачем

Скил — переиспользуемый блок инструкций в markdown, который подмешивается в
промпт рев'ю-агента. В отличие от `agents.system_prompt`, один скил можно
привязать к нескольким агентам, включать/выключать и версионировать отдельно.

Скил не выполняет код и не имеет доступа к инструментам: это только текст
конфигурации.

## 2. Что уже есть в репозитории

Фича «дошивается» — фундамент заложен:

| Слой | Что есть | Где |
|---|---|---|
| БД | `skills`, `skill_versions`, `agent_skills(order)` | `server/src/db/schema/skills.ts`, `agents.ts` |
| Контракты | `Skill`, `SkillType`, `SkillSource`, `AgentSkillLink` | `server/src/vendor/shared/contracts/knowledge.ts:114-199` |
| API | `GET/POST /agents/:id/skills` | `server/src/modules/agents/routes.ts:145-165` |
| Промпт | слот `skills` → секция `## Skills / rules` | `reviewer-core/src/prompt.ts:88,109` |
| Трасса | `prompt_assembly.skills` в контракте и в UI | `contracts/trace.ts:39-52`, `TraceBody.tsx:74-92` |
| i18n | тексты страницы Skills и импорта | `client/messages/en/skills.json` |

Ключевой разрыв: `run-executor.ts:191-213` не передаёт `skills` в
`reviewPullRequest`, поэтому в трассе всегда `skills: null` и привязка скилов
сегодня ни на что не влияет.

## 3. Решения

| Вопрос | Решение |
|---|---|
| Раскладка | Полностью повторяет агентов: `/skills` — грид карточек, `/skills/:id` — сплит-пейн с колонкой списка слева и табами справа |
| Вкладки редактора | Config, Preview, Stats, Versions. Evals — вне объёма |
| Импорт | Только markdown-файл. Ни архивов, ни URL, ни community |
| `source` для импорта | Переиспользуем `imported_url` (бейдж «Imported»), без миграции enum |
| Доверие | Импортированный скил создаётся с `enabled=false`, бейдж «needs vetting»; после включения идёт в промпт как обычные инструкции, без `wrapUntrusted` |
| Вкл/выкл у агента | Новая колонка `agent_skills.enabled` |
| Токены | Оценка на клиенте `ceil(chars/4)`, контракты не трогаем |
| Новые сущности | 1 агент (Test Quality Reviewer) + 4 скила |
| Редактор тела | `Textarea mono` + собственный гуттер с номерами строк, без новых зависимостей |
| Stats | `Used by` и `Findings (30D)` — из БД; `Pull frequency` и `Accept rate` — не отслеживаются |

## 4. Модель данных

### 4.1 Миграция

Одна миграция (`pnpm db:generate` в `server/`):

    ALTER TABLE agent_skills ADD COLUMN enabled boolean NOT NULL DEFAULT true;

Больше изменений схемы нет: `skills`, `skill_versions` уже готовы.

### 4.2 Семантика полей

- `skills.enabled` — глобальный выключатель. Выключенный скил не попадает ни в
  один промпт, независимо от привязок.
- `agent_skills.enabled` — выключатель для конкретного агента.
- `agent_skills.order` — порядок блоков в промпте, начиная с 0.
- Скил идёт в промпт только если `skills.enabled AND agent_skills.enabled`.
- `skills.version` растёт **только при изменении `body`**; правка `name`,
  `description`, `type`, `enabled` версию не бумпает (в `skill_versions`
  хранится лишь `body`).
- Снапшот в `skill_versions` пишется в той же транзакции, что и `UPDATE`,
  с `onConflictDoNothing()` — как в `agents/repository.ts:148-166`.
- Удаление скила каскадом убирает строки `agent_skills`; агенты остаются.

### 4.3 Контракты

Правим **обе** копии (`server/src/vendor/shared/`, `client/src/vendor/shared/`)
идентично — скрипта синхронизации нет.

В `contracts/knowledge.ts`:

- `AgentSkillLink` — добавить `enabled: z.boolean()`.
- Новый `AgentSkillLinkView` = `AgentSkillLink` + `name`, `type`,
  `skill_enabled` — чтобы вкладка Skills у агента рендерилась без N+1.
- Новый `SkillVersion` = `{ skill_id, version, body, created_at }`.
- Новый `SkillStats`:
  `{ used_by_agents: number, findings_30d: number,
     findings_by_category: Record<FindingCategory, number>,
     pull_frequency: number | null, accept_rate: number | null }`.

`Skill`, `SkillType`, `SkillSource` не меняем.

## 5. Сервер

### 5.1 Модуль `server/src/modules/skills/`

Структура один в один с `modules/agents/`: `routes.ts` (дефолтный экспорт —
Fastify-плагин), `service.ts`, `repository.ts`, `helpers.ts`, `constants.ts`.

Регистрация: одна строка в `server/src/modules/index.ts` (модуль там уже
упомянут как планируемый). Репозиторий выставить на DI-контейнере как
`skillsRepo` — он нужен модулю reviews.

Все запросы скоупятся по `workspaceId` через `getContext()`. Ошибки — через
`NotFoundError`, глобальный хендлер оформляет конверт.

### 5.2 Эндпоинты

| Метод | Путь | Тело / параметры | Ответ |
|---|---|---|---|
| GET | `/skills` | — | `Skill[]` |
| GET | `/skills/:id` | uuid | `Skill` |
| POST | `/skills` | `name`, `description`, `type`, `body`, `enabled?` | 201 `Skill` |
| PUT | `/skills/:id` | те же поля, все опциональны | `Skill` |
| DELETE | `/skills/:id` | uuid | `{ ok: true }` |
| GET | `/skills/:id/versions` | uuid | `SkillVersion[]`, новые первыми |
| GET | `/skills/:id/versions/:version` | uuid + int | `SkillVersion` |
| GET | `/skills/:id/stats` | uuid | `SkillStats` |
| POST | `/skills/import` | `{ name?, description?, type?, body }` | 201 `Skill` |

Правила `POST /skills`: `source: 'manual'`, `enabled` по умолчанию `true`.

Правила `POST /skills/import`:

- `source: 'imported_url'`, `enabled: false` **всегда** — вычитка обязательна;
- `body` — строка, `min(1).max(200_000)` (глобальный `bodyLimit` 1 МБ);
- `name` необязателен: если пуст, берётся текст первого `# heading`, иначе
  `imported-skill`;
- `type` по умолчанию `custom`;
- содержимое сохраняется как есть, ничего не парсится и не исполняется.

Ответы Zod-схемами не сериализуем (как в agents) — возвращаем DTO.

### 5.3 Stats: как считаем

- `used_by_agents` — `COUNT(*) FROM agent_skills WHERE skill_id = $1`.
- `findings_30d` и `findings_by_category` — findings за 30 дней из прогонов
  агентов, у которых этот скил привязан и включён. Атрибуция приблизительная
  (на уровне агента, не скила) — зафиксировать это комментарием в
  `repository.ts`, чтобы позже заменить на таблицу `skill_usage`.
- `pull_frequency` и `accept_rate` — `null` + `// TODO(skills-telemetry)`.
  UI рисует `—`. Телеметрия «скил попал в промпт» / «предложение принято» не
  собирается; заводить её — отдельная задача.

### 5.4 Изменения в модуле agents

- `GET /agents/:id/skills` возвращает `AgentSkillLinkView[]`, отсортированные
  по `order`.
- `POST /agents/:id/skills` — расширить `SetSkillsBody` до
  `{ skills: [{ skill_id, order, enabled }] }` как канонической формы
  (существующие `skill_ids` / `skill_id` оставить для совместимости).
- `PATCH /agents/:id/skills/:skillId` — переключить `enabled` у связи.
- `DELETE /agents/:id/skills/:skillId` — отвязать; `repository.unlinkSkill()`
  уже написан, роута нет.
- Правки привязок **не бумпают** `agents.version` — текущее поведение
  сохраняем.

## 6. Инъекция в промпт и трасса

Это ядро фичи. `reviewer-core` **не меняем**.

В `server/src/modules/reviews/run-executor.ts` перед вызовом
`reviewPullRequest`:

1. Загрузить тела скилов: `skillsRepo.bodiesForAgent(agentId)` →
   `SELECT s.name, s.body FROM agent_skills l JOIN skills s ON s.id = l.skill_id
   WHERE l.agent_id = $1 AND l.enabled AND s.enabled ORDER BY l.order ASC`.
2. Каждое тело префиксовать заголовком `### <name>` — чтобы блок в трассе
   читался поскилово. Склейка в один блок делается уже в `assemblePrompt`.
3. Передать `...(bodies.length ? { skills: bodies } : {})` в
   `reviewPullRequest`. Пустой массив не передаём — секции быть не должно
   (конвенция reviewer-core: отсутствующий слот не рендерится).
4. Залогировать событие в `runLog`: `skills.loaded` с `{ count, names }` —
   в live-логе видно, какие скилы подтянулись.
5. В аварийном пути `traceFromBuffer()` (`run-executor.ts:435`) тоже проставить
   `skills`, иначе при падении блок теряется.

После этого `prompt_assembly.skills` перестаёт быть `null`, и уже существующий
`PromptBlock` в `TraceBody.tsx` отрисует блок «Skills» без правок.

В клиентском `TraceBody` добавить рядом с меткой блока оценку токенов
`~N tokens` (`ceil(text.length / 4)`) — для всех блоков одинаково, чтобы
«додані токени» были видны сравнением прогонов.

## 7. Клиент

### 7.1 Навигация

В `client/src/vendor/ui/nav.ts` (вендорный файл — правка осознанная) добавить
секцию `SKILLS LAB` и перенести туда `Agents`, добавить `Skills`
(`href: "/skills"`, icon `Sparkles`, `gKey: "s"`). Пункты из макета, для которых
нет роутов (Conventions, Eval Dashboard, Multi-Agent Review, Agent Performance,
CI Runs, Memory, Project Context), **не добавляем** — иначе получим мёртвые
ссылки. `activeKeyFor()` уже умеет `/skills`.

### 7.2 Раскладка: полный аналог агентов

Механика повторяет `/agents` буквально, включая размеры и поведение.

**`/skills` — грид карточек.** Тонкий серверный `page.tsx` → клиентский
`SkillsListView` внутри `AppShell` с крошками `Skills Lab / Skills`. Шапка:
заголовок, подзаголовок, поиск, справа `Add Skill` — `Dropdown` с пунктами
«Create skill» и «Import from file». Грид —
`repeat(auto-fill, minmax(280px, 1fr))`, `gap: 14`, как
`AgentsListView/constants.ts`. Состояния `Skeleton` / `ErrorState` /
`EmptyState` — по образцу `AgentsListView.tsx:66-82`. Клик по карточке:
`router.push('/skills/:id?tab=config')`.

**`/skills/:id` — экран со скриншотов.** Клиентский `page.tsx`, повторяющий
`agents/[id]/page.tsx`: контейнер `height: calc(100vh - 52px)`, слева колонка
`width: 280`, `flexShrink: 0`, `borderRight: 1px solid var(--border)`,
`background: var(--bg-surface)` — заголовок «Skills», кнопка `Add Skill` и
прокручиваемый список `SkillCard` с `active={s.id === id}`; справа шапка
(иконка, имя, бейдж типа, бейдж версии `v{n}`, справа `Run on evals` —
задизейблен с тайтлом «Coming soon», раз вкладка Evals вне объёма) и под ней
таб-бар с телом. Состояние таба живёт в `?tab=`, `VALID_TABS = ["config",
"preview", "stats", "versions"]`, невалидное значение схлопывается в `config`.
Крошки: `Skills Lab / Skills / <имя>`.

Структура папок:

    client/src/app/skills/
    ├── page.tsx                       # server, тонкий → SkillsListView
    ├── _components/
    │   ├── SkillCard/                 # карточка: и в гриде, и в левой колонке
    │   ├── SkillsListView/
    │   │   └── _components/ImportSkillDrawer/
    │   └── SkillBodyEditor/           # textarea + гуттер + счётчик токенов
    └── [id]/
        ├── page.tsx                   # "use client": сплит-пейн, ?tab= в URL
        └── _components/SkillEditor/
            └── _components/{ConfigTab,PreviewTab,StatsTab,VersionsTab}/

`SkillCard` — один компонент для обоих мест, как `AgentCard`: принимает
`active?`, `onClick`, `onToggle`. Содержимое: иконка, имя моноширинным, тумблер
`enabled`, кнопка удаления, описание в две строки, бейджи типа (`rubric`) и
источника (`Manual` / `Imported` / `Extracted` / `Community`), строка метрик
`N agents · —% pull · —% accept`. Для `source != 'manual'` при `enabled=false` —
бейдж «needs vetting» с тайтлом «Untrusted source — vet before enabling».

### 7.3 Вкладки редактора

**Config** — форма: `Name` (обяз.), `Description`, `Type` (select по
`SkillType`), `Skill body` (`SkillBodyEditor`). Подпись под описанием
директивная, из требований: описание — это интерфейс скила, по нему агент
решает, подтягивать его или нет. Шапка вкладки: бейдж `v{version}`, тумблер
`Enabled`, кнопка `Save`. Пока форма грязная — бейдж `unsaved` рядом с именем
файла и активная кнопка `Save`; после успеха — тост и сброс dirty.

**Preview** — заголовок «Rendered as the reviewing agent receives it», рендер
`body` через примитив `Markdown` (`@devdigest/ui`) внутри карточки.

**Stats** — четыре `MetricCard` (`Used by`, `Pull frequency`, `Accept rate`,
`Findings (30D)`), список «Agents using this skill» со ссылками на
`/agents/:id`, донат `Findings by category`. Внимание: `Donut` показать со
**счётным** форматтером, не с денежным — на макете подписи в долларах, это
артефакт прототипа. Для `null`-метрик — `—` и тайтл «Not tracked yet».

**Versions** — список версий из `GET /skills/:id/versions`, номер и дата,
раскрытие тела в `Markdown`. Только чтение, отката в этом объёме нет.

### 7.4 SkillBodyEditor

Без новых зависимостей: `Textarea mono` + абсолютно спозиционированный гуттер с
номерами строк, синхронизируемый по `scrollTop`. Над полем — чип `<slug>.md`,
бейдж `unsaved`, справа `~N tokens` (`ceil(value.length / 4)`, пересчёт на
каждый ввод).

### 7.5 Импорт

Кнопка `Add Skill` — дропдаун: `Create skill` (модалка как `CreateAgentModal`)
и `Import from file` (дровер).

Дровер импорта:

1. `<input type="file" accept=".md,.markdown,text/markdown">`. Любое другое
   расширение или MIME — inline-ошибка «Only .md files are supported», запрос
   не уходит. Архивы не принимаются, распаковки в коде нет.
2. Файл читается в браузере (`file.text()`), имя предзаполняется из первого
   `# heading`.
3. Экран превью: имя, тип, рендер `Markdown` тела, предупреждение о доверии —
   чужой скил это чужие инструкции в промпте агента, он будет создан
   выключенным.
4. Только по кнопке `Import skill` уходит `POST /skills/import`. До
   подтверждения в БД ничего не пишется.
5. Успех: тост, переход на `/skills/:id`, скил в списке выключен и помечен
   «needs vetting».

### 7.6 Вкладка Skills в редакторе агента

В `client/src/app/agents/[id]/_components/AgentEditor/constants.ts` добавить таб
`skills` (ключ i18n `editor.tabs.skills` уже есть) и в `VALID_TABS` на
`agents/[id]/page.tsx`.

Содержимое: упорядоченный список привязанных скилов; у каждого — тумблер
`enabled` (мгновенный `PATCH`), кнопки вверх/вниз для порядка (drag-n-drop не
делаем, библиотеки нет), кнопка отвязки, ссылка на скил. Сверху дропдаун
«Add skill» с непривязанными скилами воркспейса. Подпись: порядок определяет
последовательность блоков в промпте.

### 7.7 Данные и i18n

`client/src/lib/hooks/skills.ts`, реэкспорт из `lib/hooks/index.ts`:
`useSkills`, `useSkill`, `useSkillVersions`, `useSkillStats`, `useCreateSkill`,
`useUpdateSkill`, `useDeleteSkill`, `useImportSkill`; ключи `["skills"]`,
`["skill", id]`, `["skill-versions", id]`, `["skill-stats", id]`. Мутации
инвалидируют список и делают `setQueryData(["skill", id])`. В
`lib/hooks/agents.ts` — `useAgentSkills`, `useSetAgentSkills`,
`useToggleAgentSkill`, `useUnlinkAgentSkill`.

Компоненты не ходят в `fetch` напрямую — только через `lib/api.ts`.

`client/messages/en/skills.json` уже содержит `page`, `detail`, `drawer`,
`file`, `listItem`, `preview`. Дописать ветку `editor` (лейблы табов, `unsaved`,
`tokens`, поля формы, тексты Stats и Versions) и `page.subtitle` для шапки
грида. Ветки `url` и `community` оставить нетронутыми — они для будущих
источников импорта.

## 8. Сид: агент и скилы

Новый агент **Test Quality Reviewer** — проверяет качество тестов: непокрытые
ветки, пропущенные corner cases, избыточное мокирование, флейки. Промпт-исходник
в `docs/agent-prompts/test-quality-reviewer.md` по формату из
`docs/agent-prompts/README.md` (роль, что искать, рубрика severity, семантика
вердикта, дисциплина findings), тело дублируется в
`server/src/db/seed-prompts.ts` и вставляется в `seed.ts` идемпотентно.

Четыре скила:

| Скил | Тип | Как заводится | Привязка |
|---|---|---|---|
| `test-coverage-nudge` | custom | сид (`manual`) | Test Quality Reviewer |
| `test-corner-cases` | rubric | сид (`manual`) | Test Quality Reviewer |
| `pr-quality-rubric` | rubric | сид (`manual`) | Test Quality Reviewer |
| `api-contract-breaking-change` | convention | **импорт через UI** из `docs/sample-skills/api-contract-breaking-change.md` | General Reviewer (после вычитки и включения) |

Файл для импорта кладём в `docs/sample-skills/` заранее — это и есть
демонстрация полного пути импорта, включая превью и вычитку. Папка намеренно
называется не `docs/skills/`, чтобы не путать её с `.claude/skills/` —
рабочими скилами агентов в самом репозитории.

Важно: сид вставляет агента напрямую, минуя репозиторий, поэтому строки в
`agent_versions` не появляются, пока агента не отредактируют через API. Это
существующее поведение, менять его в рамках фичи не нужно.

## 9. Контрольный эксперимент

Оба сценария гоняются как «до/после» переключением `agent_skills.enabled`, без
редактирования промптов.

**Test Quality.** PR с тестом только на happy-path. Прогон 1: у Test Quality
Reviewer все скилы выключены — ожидаем пропуск. Прогон 2: скилы включены —
ожидаем находки про непокрытую ветку и граничный случай.

**API Contract.** PR со сменой сигнатуры роута. Прогон 1: General Reviewer без
`api-contract-breaking-change` — пропуск. Прогон 2: скил включён — обнаружен
breaking change.

В обоих случаях открываем трассу прогона → секцию `Prompt assembly`: во втором
прогоне присутствует блок `Skills`, а суммарные `tokens_in` выше на величину
блока.

Сценарий и ожидаемые находки записать в `docs/experiments/skills-ab.md`.

## 10. Тесты

Сервер (`server/test/`, vitest + Testcontainers, гейт по `dockerAvailable()`):

- `skills.it.test.ts` — CRUD, изоляция по воркспейсу, бамп версии только при
  смене `body`, снапшот в `skill_versions`, импорт создаёт `enabled=false` и
  `source='imported_url'`, отказ на пустом теле.
- `agent-skills.it.test.ts` — привязка, порядок, `PATCH` тумблера, отвязка,
  каскад при удалении скила.
- `run-executor` — юнит на хелпер резолва: возвращает только пары «глобально
  включён + включён у агента», в порядке `order`; выключенный скил не попадает в
  `prompt_assembly.skills`; при нуле скилов слот `null`.

Клиент (`client/`, vitest + RTL, fetch замокан): `SkillCard`, `SkillsListView`
(поиск, грид, пустое состояние, переход по клику), `SkillEditor` (переключение
табов через `?tab=`, dirty/unsaved), `ImportSkillDrawer` (отказ на не-md, превью
до сохранения, вызов импорта только по подтверждению), `SkillsTab` редактора
агента (тумблер и порядок).

## 11. Критерии приёмки

1. Скил создаётся и редактируется в UI; смена тела поднимает версию, она видна
   на вкладке Versions.
2. У Test Quality Reviewer привязаны свои скилы; у General Reviewer —
   импортированный `api-contract-breaking-change`.
3. Включённый скил виден в трассе отдельным блоком `Skills` и в live-логе
   событием `skills.loaded`; выключенный — не виден ни там, ни там.
4. Импорт прошёл через экран превью; принимается только `.md`; исполняемое
   ничего не запускалось, распаковки архивов в кодовой базе нет.
5. Контрольный эксперимент воспроизводится на обоих сценариях, разница в
   `tokens_in` между прогонами видна.
6. `pr-self-review` существует с выключенным автовызовом
   (`.claude/skills/pr-self-review/`), вызван вручную и подтянул и фронтовые, и
   бэкендные скилы. Это проверка репозиторной оснастки, продуктового кода не
   требует.

## 12. Вне объёма

Импорт по URL, каталог community-скилов, архивы, вкладка Evals и рабочая кнопка
«Run on evals», серверный подсчёт токенов по слотам промпта, реальная
телеметрия `pull frequency` / `accept rate`, откат к прошлой версии скила,
drag-n-drop сортировка, автоизвлечение скилов из кодовой базы
(`source: 'extracted'`).

## 13. Риски

- **Двойная копия контрактов.** `vendor/shared` продублирован в `server/` и
  `client/`, синхронизации нет. Расхождение ломает типы молча.
- **Правка вендорного `nav.ts`.** Файл помечен как вендорный; изменение может
  конфликтовать с обновлением дизайн-системы из курса.
- **Приблизительная атрибуция findings к скилу** на вкладке Stats. Цифра
  «Findings (30D)» на самом деле про агентов, использующих скил. Заменяется
  таблицей `skill_usage`, когда понадобится точность.
- **Инъекция инструкций.** Импортированный скил после включения попадает в
  промпт как доверенный текст. Единственная защита — `enabled=false` по
  умолчанию и ручная вычитка. Проговорить это в видео.
