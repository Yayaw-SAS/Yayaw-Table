import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ChevronRight,
  Columns3,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Plus,
  Settings2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { Button } from "../../../src/components/ui/button";
import { Checkbox } from "../../../src/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../src/components/ui/command";
import { Input } from "../../../src/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../src/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../src/components/ui/select";
import { Switch } from "../../../src/components/ui/switch";

const columns = ["Name", "Status", "Price", "Created", "Active"];

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-muted-foreground text-xs" htmlFor={id}>
        {label}
      </label>
      <Select
        onValueChange={(next) => {
          if (next) {
            onChange(next);
          }
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
  onReset,
  count,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  onReset?: () => void;
  count?: number;
}) {
  return (
    <section aria-label={`${title} proposal`} className="proposal-panel">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        {icon}
        <h3 className="flex-1 font-medium text-sm">
          {title}{" "}
          {count !== undefined && (
            <span className="ml-1 text-muted-foreground">{count}</span>
          )}
        </h3>
        {onReset && (
          <Button onClick={onReset} size="sm" variant="ghost">
            Reset
          </Button>
        )}
      </header>
      {children}
    </section>
  );
}

function PropertyPicker({
  label,
  excluded = [],
  onSelect,
}: {
  label: string;
  excluded?: string[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button className="w-full justify-start" variant="outline">
            <Plus />
            {label}
          </Button>
        }
      />
      <PopoverContent align="start" aria-label={label} className="p-0">
        <Command>
          <CommandInput
            aria-label="Search properties"
            placeholder="Search properties…"
          />
          <CommandList>
            <CommandEmpty>No matching property.</CommandEmpty>
            {columns
              .filter((column) => !excluded.includes(column))
              .map((column) => (
                <CommandItem
                  key={column}
                  onSelect={() => {
                    onSelect(column);
                    setOpen(false);
                  }}
                  value={column}
                >
                  {column}
                </CommandItem>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface Rule {
  id: string;
  column: string;
  operator: string;
  value: string;
  enabled: boolean;
}
const initialRules: Rule[] = [
  {
    id: "status",
    column: "Status",
    operator: "Is",
    value: "Open",
    enabled: true,
  },
];

function FilterPanel() {
  const [rules, setRules] = useState(initialRules);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [match, setMatch] = useState("All conditions");
  const inputId = useId();
  const invalid =
    editing?.column === "Price" &&
    (editing.value.trim() === "" || !Number.isFinite(Number(editing.value)));
  const updateDraft = (patch: Partial<Rule>) =>
    setEditing((current) => (current ? { ...current, ...patch } : current));
  const apply = () => {
    if (!editing || invalid || !editing.value.trim()) {
      return;
    }
    const exists = rules.some((rule) => rule.id === editing.id);
    setRules(
      exists
        ? rules.map((rule) => (rule.id === editing.id ? editing : rule))
        : [...rules, editing]
    );
    setEditing(null);
  };
  return (
    <Panel
      count={rules.length}
      icon={<Filter className="size-4" />}
      onReset={() => {
        setRules([]);
        setEditing(null);
      }}
      title="Filters"
    >
      <div className="grid gap-4 p-4">
        <Choice
          label="Match"
          onChange={setMatch}
          options={["All conditions", "Any condition"]}
          value={match}
        />
        {rules.map((rule) => (
          <div className="flex items-center gap-2" key={rule.id}>
            <Button
              className="min-w-0 flex-1 justify-start"
              onClick={() => setEditing({ ...rule })}
              variant="ghost"
            >
              <span className="truncate">
                {rule.column}{" "}
                <span className="font-normal text-muted-foreground">
                  {rule.operator.toLowerCase()} {rule.value}
                </span>
              </span>
            </Button>
            <Switch
              aria-label={`Enable ${rule.column} filter`}
              checked={rule.enabled}
              onCheckedChange={(enabled) =>
                setRules(
                  rules.map((item) =>
                    item.id === rule.id ? { ...item, enabled } : item
                  )
                )
              }
            />
            <Button
              aria-label={`Remove ${rule.column} filter`}
              onClick={() =>
                setRules(rules.filter((item) => item.id !== rule.id))
              }
              size="icon-sm"
              variant="ghost"
            >
              <X />
            </Button>
          </div>
        ))}
        {rules.length === 0 && !editing && (
          <p className="text-muted-foreground text-sm">
            No filters. All records are included.
          </p>
        )}
        {editing ? (
          <form
            className="grid gap-3 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              apply();
            }}
          >
            <Choice
              label="Property"
              onChange={(column) =>
                updateDraft({
                  column,
                  value: "",
                  operator: column === "Price" ? "Greater than" : "Is",
                })
              }
              options={columns}
              value={editing.column}
            />
            <Choice
              label="Condition"
              onChange={(operator) => updateDraft({ operator })}
              options={
                editing.column === "Price"
                  ? ["Is", "Greater than", "Less than"]
                  : ["Is", "Is not", "Contains"]
              }
              value={editing.operator}
            />
            {editing.column === "Status" ? (
              <Choice
                label="Value"
                onChange={(value) => updateDraft({ value })}
                options={["Open", "Closed"]}
                value={editing.value || "Open"}
              />
            ) : (
              <div className="grid gap-1.5">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor={inputId}
                >
                  Value
                </label>
                <Input
                  id={inputId}
                  onChange={(event) =>
                    updateDraft({ value: event.target.value })
                  }
                  placeholder="Enter a value…"
                  type={editing.column === "Price" ? "number" : "text"}
                  value={editing.value}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                onClick={() => setEditing(null)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={Boolean(invalid) || !editing.value.trim()}
                type="submit"
              >
                Apply
              </Button>
            </div>
          </form>
        ) : (
          <PropertyPicker
            label="Add filter"
            onSelect={(column) =>
              setEditing({
                id: crypto.randomUUID(),
                column,
                operator: column === "Price" ? "Greater than" : "Is",
                value: column === "Status" ? "Open" : "",
                enabled: true,
              })
            }
          />
        )}
      </div>
      <footer className="border-t px-4 py-3 text-muted-foreground text-xs">
        Edit a condition, then apply it. Cancel keeps the previous value.
      </footer>
    </Panel>
  );
}

interface Sort {
  id: string;
  column: string;
  direction: string;
}
function SortPanel() {
  const [sorts, setSorts] = useState<Sort[]>([
    { id: "created", column: "Created", direction: "Newest first" },
  ]);
  const move = (index: number, direction: number) => {
    const next = [...sorts];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setSorts(next);
  };
  return (
    <Panel
      count={sorts.length}
      icon={<ArrowDownAZ className="size-4" />}
      onReset={() => setSorts([])}
      title="Sort"
    >
      <div className="grid gap-4 p-4">
        {sorts.map((sort, index) => (
          <div className="grid gap-3" key={sort.id}>
            <div className="flex items-center gap-1">
              <span className="flex-1 text-muted-foreground text-xs">
                {index === 0 ? "Sort by" : "Then by"} · Priority {index + 1}
              </span>
              <Button
                aria-label={`Move ${sort.column} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                size="icon-sm"
                variant="ghost"
              >
                <ArrowUp />
              </Button>
              <Button
                aria-label={`Move ${sort.column} down`}
                disabled={index === sorts.length - 1}
                onClick={() => move(index, 1)}
                size="icon-sm"
                variant="ghost"
              >
                <ArrowDown />
              </Button>
              <Button
                aria-label={`Remove ${sort.column} sort`}
                onClick={() =>
                  setSorts(sorts.filter((item) => item.id !== sort.id))
                }
                size="icon-sm"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
            <Choice
              label="Property"
              onChange={(column) =>
                setSorts(
                  sorts.map((item) =>
                    item.id === sort.id
                      ? {
                          ...item,
                          column,
                          direction:
                            column === "Created" ? "Newest first" : "Ascending",
                        }
                      : item
                  )
                )
              }
              options={columns.filter(
                (column) =>
                  column === sort.column ||
                  !sorts.some((item) => item.column === column)
              )}
              value={sort.column}
            />
            <Choice
              label="Direction"
              onChange={(direction) =>
                setSorts(
                  sorts.map((item) =>
                    item.id === sort.id ? { ...item, direction } : item
                  )
                )
              }
              options={
                sort.column === "Created"
                  ? ["Newest first", "Oldest first"]
                  : ["Ascending", "Descending"]
              }
              value={sort.direction}
            />
          </div>
        ))}
        {sorts.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No sort. Original record order.
          </p>
        )}
        {sorts.length < columns.length && (
          <PropertyPicker
            excluded={sorts.map((sort) => sort.column)}
            label="Add sort"
            onSelect={(column) =>
              setSorts([
                ...sorts,
                {
                  id: crypto.randomUUID(),
                  column,
                  direction:
                    column === "Created" ? "Newest first" : "Ascending",
                },
              ])
            }
          />
        )}
      </div>
      <footer className="border-t px-4 py-3 text-muted-foreground text-xs">
        Applied immediately. Priority is explicit and can be changed with
        buttons.
      </footer>
    </Panel>
  );
}

function PropertiesPanel() {
  const propertyId = useId();
  const [visible, setVisible] = useState(columns);
  const [query, setQuery] = useState("");
  return (
    <Panel
      count={visible.length}
      icon={<Columns3 className="size-4" />}
      onReset={() => setVisible(columns)}
      title="Properties"
    >
      <div className="grid gap-3 p-4">
        <Input
          aria-label="Search visible properties"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search properties…"
          value={query}
        />
        <div className="grid gap-1">
          {columns
            .filter((column) =>
              column.toLowerCase().includes(query.toLowerCase())
            )
            .map((column) => (
              <label
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
                htmlFor={`${propertyId}-${column}`}
                key={column}
              >
                <Checkbox
                  aria-label={`Show ${column}`}
                  checked={visible.includes(column)}
                  disabled={column === "Name"}
                  id={`${propertyId}-${column}`}
                  onCheckedChange={(checked) =>
                    setVisible(
                      checked
                        ? [...visible, column]
                        : visible.filter((item) => item !== column)
                    )
                  }
                />
                <span className="flex-1">{column}</span>
                {column === "Name" && (
                  <span className="text-muted-foreground text-xs">
                    Required
                  </span>
                )}
              </label>
            ))}
        </div>
      </div>
      <footer className="border-t px-4 py-3 text-muted-foreground text-xs">
        A checkbox expresses visibility. Required properties stay visible.
      </footer>
    </Panel>
  );
}

function GroupPanel() {
  const toggleId = useId();
  const [group, setGroup] = useState("Status");
  const [direction, setDirection] = useState("Ascending");
  const [empty, setEmpty] = useState(false);
  return (
    <Panel
      icon={<Layers className="size-4" />}
      onReset={() => setGroup("None")}
      title="Group"
    >
      <div className="grid gap-4 p-4">
        <Choice
          label="Group by"
          onChange={setGroup}
          options={["None", "Status", "Active"]}
          value={group}
        />
        <Choice
          label="Group order"
          onChange={setDirection}
          options={["Ascending", "Descending"]}
          value={direction}
        />
        <label
          className="flex items-center justify-between text-sm"
          htmlFor={toggleId}
        >
          Show empty groups
          <Switch
            aria-label="Show empty groups"
            checked={empty}
            id={toggleId}
            onCheckedChange={setEmpty}
          />
        </label>
      </div>
    </Panel>
  );
}

function CardsPanel() {
  const toggleId = useId();
  const [image, setImage] = useState("Cover image");
  const [title, setTitle] = useState("Name");
  const [size, setSize] = useState("Medium");
  const [labels, setLabels] = useState(false);
  const [ratio, setRatio] = useState("Wide");
  const [fit, setFit] = useState("Cover");
  return (
    <Panel icon={<LayoutGrid className="size-4" />} title="Card settings">
      <div className="grid gap-4 p-4">
        <Choice
          label="Image"
          onChange={setImage}
          options={["None", "Cover image"]}
          value={image}
        />
        <Choice
          label="Title"
          onChange={setTitle}
          options={columns}
          value={title}
        />
        <div className="grid grid-cols-2 gap-3">
          <Choice
            label="Ratio"
            onChange={setRatio}
            options={["Wide", "Square", "Portrait"]}
            value={ratio}
          />
          <Choice
            label="Image fit"
            onChange={setFit}
            options={["Cover", "Contain"]}
            value={fit}
          />
        </div>
        <Choice
          label="Card size"
          onChange={setSize}
          options={["Small", "Medium", "Large"]}
          value={size}
        />
        <label
          className="flex items-center justify-between text-sm"
          htmlFor={toggleId}
        >
          Show property labels
          <Switch
            aria-label="Show property labels"
            checked={labels}
            id={toggleId}
            onCheckedChange={setLabels}
          />
        </label>
      </div>
      <footer className="border-t px-4 py-3 text-muted-foreground text-xs">
        Short fields keep all settings within reach.
      </footer>
    </Panel>
  );
}

function MainPanel() {
  const toggleId = useId();
  const [mode, setMode] = useState("Table");
  const [density, setDensity] = useState("M");
  const [calculations, setCalculations] = useState(true);
  return (
    <Panel icon={<Settings2 className="size-4" />} title="View settings">
      <div className="grid gap-4 p-4">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-muted-foreground text-xs">
            Display mode
          </legend>
          <div className="flex gap-1">
            {["Table", "Kanban", "Gallery"].map((option) => (
              <Button
                aria-pressed={mode === option}
                className="flex-1 font-normal"
                key={option}
                onClick={() => setMode(option)}
                size="sm"
                variant={mode === option ? "secondary" : "ghost"}
              >
                {option}
              </Button>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-muted-foreground text-xs">
            Table density
          </legend>
          <div className="flex gap-1">
            {["XS", "S", "M", "L", "XL", "2XL"].map((option) => (
              <Button
                aria-pressed={density === option}
                className="min-w-0 flex-1 px-1 font-normal"
                key={option}
                onClick={() => setDensity(option)}
                size="sm"
                variant={density === option ? "secondary" : "ghost"}
              >
                {option}
              </Button>
            ))}
          </div>
        </fieldset>
        <label
          className="flex items-center justify-between text-sm"
          htmlFor={toggleId}
        >
          Footer calculations
          <Switch
            aria-label="Footer calculations"
            checked={calculations}
            id={toggleId}
            onCheckedChange={setCalculations}
          />
        </label>
      </div>
      <div className="border-t p-2">
        {[
          { label: "Filters", icon: Filter, count: "1" },
          { label: "Sort", icon: ArrowDownAZ, count: "1" },
          { label: "Properties", icon: List, count: "5" },
        ].map(({ label, icon: Icon, count }) => (
          <div
            className="flex items-center gap-2 px-2 py-2 text-sm"
            key={label}
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex-1">{label}</span>
            <span className="text-muted-foreground text-xs">{count}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

const evidence = [
  {
    title: "React · sort",
    image: "react-sort-active",
    note: "Direction is only an icon. Clicking another column replaces the sort.",
  },
  {
    title: "React · filters",
    image: "react-filter-number",
    note: "Different spacing, a separate editor, and a different reset action.",
  },
  {
    title: "Vue · sort",
    image: "vue-sort-multiple",
    note: "Multiple sorts and native selects: a different contract and appearance.",
  },
  {
    title: "Vue · filters",
    image: "vue-filter-editor",
    note: "Column, operator, value, and AND/OR are exposed as a form.",
  },
  {
    title: "React · cards",
    image: "react-gallery-settings",
    note: "Repeated full column lists push the remaining settings below the fold.",
  },
  {
    title: "Vue · cards",
    image: "vue-gallery-settings",
    note: "Compact Reka controls already provide a useful direction.",
  },
  {
    title: "React · column menu",
    image: "react-column-menu",
    note: "Custom portal and menu items: Escape and ArrowDown failed in the audit.",
  },
  {
    title: "React · date",
    image: "react-filter-date",
    note: "Month names and weekday labels use inconsistent locales in the demo.",
  },
];

export function Proposals() {
  const [page, setPage] = useState("Filters & sort");
  const [dark, setDark] = useState(false);
  // Portaled Shadcn controls inherit the same theme as the proposal panels.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);
  return (
    <div className={dark ? "dark audit-root" : "audit-root"}>
      <div className="audit-topbar">
        <a className="font-semibold tracking-tight" href="/">
          YaYaw Table{" "}
          <span className="ml-2 font-normal text-muted-foreground">
            / UI review
          </span>
        </a>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">14 SEP 2026</span>
          <Button onClick={() => setDark(!dark)} size="sm" variant="outline">
            {dark ? "Light" : "Dark"} preview
          </Button>
          <a
            className="text-sm underline underline-offset-4"
            href="/?current=1"
          >
            Current React UI
          </a>
        </div>
      </div>
      <main className="audit-main">
        <div className="audit-intro">
          <p className="mb-3 text-muted-foreground text-xs uppercase tracking-widest">
            Design proposal · not shipped
          </p>
          <h1 className="max-w-3xl font-semibold text-4xl tracking-tight">
            One family of menus.
            <br />
            <span className="text-muted-foreground">
              Clear controls, predictable actions.
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            The same spacing, typography and component variants across filters,
            sorting and view settings. Try the controls below.
          </p>
        </div>
        <nav aria-label="Audit screens" className="mb-8 flex flex-wrap gap-2">
          {["Filters & sort", "View settings", "Current screenshots"].map(
            (item) => (
              <Button
                aria-pressed={page === item}
                key={item}
                onClick={() => setPage(item)}
                variant={page === item ? "secondary" : "ghost"}
              >
                {item}
              </Button>
            )
          )}
        </nav>
        {page === "Filters & sort" && (
          <div className="proposal-grid">
            <div>
              <p className="panel-caption">01 / FILTERS</p>
              <FilterPanel />
              <p className="panel-note">
                A readable summary, an explicit editor, and the same searchable
                property picker as sorting.
              </p>
            </div>
            <div>
              <p className="panel-caption">02 / SORT</p>
              <SortPanel />
              <p className="panel-note">
                An explicit direction and priority. Add a second sort to try
                keyboard-accessible reordering.
              </p>
            </div>
            <aside className="audit-aside">
              <p className="text-muted-foreground text-xs uppercase tracking-widest">
                Recommended foundation
              </p>
              <h2 className="mt-3 font-medium text-xl">
                Use the components as components.
              </h2>
              <p className="mt-3 text-muted-foreground text-sm">
                These proposals import the repository’s Button, Input, Select,
                Checkbox, Switch, Popover and Command. Control heights, borders,
                focus rings and shadows use their existing variants.
              </p>
              <ul className="mt-5 grid gap-3 text-sm">
                <li>Consistent headers and reset placement</li>
                <li>Visible labels above form fields</li>
                <li>Neutral state styling</li>
                <li>Searchable property selection</li>
                <li>
                  Clear distinction between draft edits and immediate choices
                </li>
              </ul>
              <p className="mt-5 border-t pt-4 text-muted-foreground text-xs">
                Prototype only. Data is local; controls do not change a table.
                AND/OR and multiple sorts are proposed parity work. The current
                React implementation does not expose the same controls as Vue.
              </p>
            </aside>
          </div>
        )}
        {page === "View settings" && (
          <div className="proposal-grid settings-grid">
            <div>
              <p className="panel-caption">03 / VIEW SETTINGS</p>
              <MainPanel />
            </div>
            <div>
              <p className="panel-caption">04 / PROPERTIES</p>
              <PropertiesPanel />
            </div>
            <div>
              <p className="panel-caption">05 / CARDS</p>
              <CardsPanel />
            </div>
            <div>
              <p className="panel-caption">06 / GROUPING</p>
              <GroupPanel />
            </div>
            <aside className="audit-aside">
              <h2 className="font-medium text-xl">
                Normal weight. Clear selection.
              </h2>
              <p className="mt-3 text-muted-foreground text-sm">
                Display mode and density stay at weight 400, including the
                selected option. A neutral background conveys selection. Use
                Select for a single choice, Checkbox for membership, Switch for
                a boolean, and a standard DropdownMenu for actions. The
                main-menu rows are static navigation illustrations.
              </p>
              <p className="mt-3 text-muted-foreground text-sm">
                Grouping order and empty-group controls are design proposals;
                implementation requires checking both public contracts.
              </p>
            </aside>
          </div>
        )}
        {page === "Current screenshots" && (
          <div className="evidence-grid">
            {evidence.map((item) => (
              <figure
                className="overflow-hidden rounded-lg border bg-background"
                key={item.image}
              >
                <a href={`/${item.image}.png`} rel="noopener" target="_blank">
                  <img
                    alt={item.title}
                    height={712}
                    src={`/${item.image}.png`}
                    width={1265}
                  />
                </a>
                <figcaption className="p-4">
                  <strong className="text-sm">{item.title}</strong>
                  <p className="mt-2 text-muted-foreground text-sm">
                    {item.note}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t pt-5 text-muted-foreground text-xs">
          <span>Internal review · based on main 859c942 · React + Vue</span>
          <span>
            Desktop proposals · production mobile sheet remains part of
            implementation
          </span>
        </footer>
      </main>
    </div>
  );
}
