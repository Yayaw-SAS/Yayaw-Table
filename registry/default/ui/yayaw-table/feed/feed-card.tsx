"use client";

import { FileText } from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  type FeedBodyRenderer,
  type FeedColumn,
  type FeedLabelKey,
  type FeedMedia,
  type FeedPropertyValue,
  feedAuthor,
  feedBodyNeedsToggle,
  feedBodyText,
  feedDate,
  feedPropertyValue,
  feedRowMedia,
  feedValue,
  type ResolvedFeedSettings,
} from "../utils/feed-view";
import type { TableGalleryMediaConfig } from "../utils/media-contract";
import "../utils/tag-colors.css";

type RowRecord = Record<string, unknown>;

export type FeedLabel = (
  key: FeedLabelKey,
  params?: Record<string, number | string>
) => string;

export interface FeedCardProps {
  row: RowRecord;
  columns: Map<string, FeedColumn>;
  settings: ResolvedFeedSettings;
  locale: string;
  coloredTags: boolean;
  label: FeedLabel;
  renderBody?: FeedBodyRenderer;
  onOpen: (row: RowRecord, event: MouseEvent<HTMLElement>) => void;
  now: Date;
  position: number;
  rowId: string;
  setSize: number;
  /** "Show more" state, kept by the view per row id so it survives windowing. */
  expanded: boolean;
  onToggleExpanded: (rowId: string) => void;
  /** `table.gallery.media` and image column: the media contract of the table. */
  gallery?: TableGalleryMediaConfig;
  imageColumn?: string;
}

/** Line height of the body, in em, so clamped heights match both editions. */
const BODY_LINE_HEIGHT = 1.5;

function clampStyle(lines: number, custom: boolean): CSSProperties {
  if (custom) {
    return { maxHeight: `${lines * BODY_LINE_HEIGHT}em`, overflow: "hidden" };
  }
  return {
    display: "-webkit-box",
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
  };
}

function FeedBody({
  content,
  expanded,
  label,
  lines,
  onToggle,
  text,
}: {
  content?: ReactNode;
  expanded: boolean;
  label: FeedLabel;
  lines: number;
  onToggle: () => void;
  text: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const custom = content !== undefined;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || expanded) {
      return;
    }
    const measure = () =>
      setOverflows(
        feedBodyNeedsToggle(text, lines, {
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        })
      );
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, lines, text]);
  const clamped = lines > 0 && !expanded;
  return (
    <div className="grid justify-items-start gap-1">
      <div
        className={cn(
          "w-full break-words text-sm",
          custom ? "yayaw-feed-rich" : "whitespace-pre-wrap"
        )}
        data-expanded={expanded ? "true" : "false"}
        data-feed-body
        id={id}
        ref={ref}
        style={{
          lineHeight: BODY_LINE_HEIGHT,
          ...(clamped ? clampStyle(lines, custom) : {}),
        }}
      >
        {custom ? content : text}
      </div>
      {overflows || expanded ? (
        <button
          aria-controls={id}
          aria-expanded={expanded}
          className="rounded-sm font-medium text-muted-foreground text-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onToggle}
          type="button"
        >
          {expanded ? label("showLess") : label("showMore")}
        </button>
      ) : null}
    </div>
  );
}

function FeedByline({
  author,
  column,
  date,
  label,
}: {
  author: ReturnType<typeof feedAuthor>;
  column?: FeedColumn;
  date: ReturnType<typeof feedDate>;
  label: FeedLabel;
}) {
  if (!(author || date)) {
    return null;
  }
  return (
    <div
      className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs"
      data-feed-byline
    >
      {author ? (
        <span className="flex min-w-0 items-center gap-2" data-feed-author>
          {author.avatarUrl ? (
            <img
              alt=""
              className="size-6 shrink-0 rounded-full object-cover"
              decoding="async"
              height={24}
              loading="lazy"
              src={author.avatarUrl}
              width={24}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-[0.625rem] text-foreground"
            >
              {author.initials}
            </span>
          )}
          <span className="truncate font-medium text-foreground">
            <span className="sr-only">{`${label("by")} `}</span>
            {author.name}
          </span>
        </span>
      ) : null}
      {author && date ? <span aria-hidden="true">·</span> : null}
      {date ? (
        <time
          className="shrink-0"
          data-feed-date
          data-feed-date-column={column?.id}
          dateTime={date.dateTime}
          title={date.title}
        >
          {date.text}
        </time>
      ) : null}
    </div>
  );
}

function FeedVideos({
  label,
  media,
  title,
}: {
  label: FeedLabel;
  media: FeedMedia;
  title: string;
}) {
  if (!media.videos.length) {
    return null;
  }
  return (
    <div className="grid gap-2">
      {media.videos.map((video) => (
        // biome-ignore lint/a11y/useMediaCaption: caption tracks are rendered from the media's `tracks` below.
        <video
          aria-label={video.alt || label("video", { title })}
          className="aspect-video w-full rounded-md border bg-black object-contain"
          controls
          data-feed-video
          height={405}
          key={video.url}
          playsInline
          poster={video.poster}
          // The poster stands for the video: nothing loads beyond metadata before it plays.
          preload={video.poster ? "none" : "metadata"}
          width={720}
        >
          <source src={video.url} type={video.mimeType} />
          {video.tracks.map((track) => (
            <track
              key={`${track.srcLang ?? ""}:${track.src}`}
              kind={track.kind}
              label={track.label}
              src={track.src}
              srcLang={track.srcLang}
            />
          ))}
        </video>
      ))}
    </div>
  );
}

function FeedMediaBlock({
  label,
  media,
  title,
}: {
  label: FeedLabel;
  media: FeedMedia;
  title: string;
}) {
  if (!(media.images.length || media.videos.length || media.files.length)) {
    return null;
  }
  return (
    <div className="grid gap-2" data-feed-media>
      {media.images.length ? (
        <ul
          aria-label={label("media", { title })}
          className={cn(
            "grid gap-1 overflow-hidden rounded-md border bg-muted/40",
            media.images.length > 1 ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          {media.images.map((image, index) => (
            <li className="relative" key={image.url}>
              {/* Lazy, decoded off the main thread, in a box of fixed ratio: no layout shift. */}
              <img
                alt={image.alt}
                className={cn(
                  "w-full object-cover",
                  media.images.length > 1 ? "aspect-square" : "aspect-[16/10]"
                )}
                decoding="async"
                height={media.images.length > 1 ? 360 : 450}
                loading="lazy"
                src={image.url}
                width={720}
              />
              {media.moreImages > 0 && index === media.images.length - 1 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 font-medium text-lg text-white">
                  {label("moreImages", { count: media.moreImages })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <FeedVideos label={label} media={media} title={title} />
      {media.files.length ? (
        <ul className="flex flex-wrap gap-2">
          {media.files.map((file) => (
            <li
              className="flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
              key={`${file.name}:${file.url ?? ""}`}
            >
              <FileText aria-hidden="true" className="size-3.5 shrink-0" />
              {file.url ? (
                <a
                  className="truncate hover:underline"
                  href={file.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {file.name}
                </a>
              ) : (
                <span className="truncate">{file.name}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PropertyValue({ value }: { value: FeedPropertyValue }) {
  if (value.kind === "tags") {
    return (
      <span className="flex flex-wrap gap-1">
        {value.tags.map((tag) => (
          <span
            className={cn(
              "yayaw-tag inline-flex items-center rounded-md px-2 py-0.5 text-xs",
              tag.className
            )}
            data-colored={tag.colored}
            data-custom-color={tag.className ? "" : undefined}
            key={tag.id}
            style={tag.style}
          >
            {tag.text}
          </span>
        ))}
      </span>
    );
  }
  if (value.kind === "link") {
    return (
      <a
        className="truncate underline-offset-2 hover:underline"
        href={value.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {value.text}
      </a>
    );
  }
  return <span className="truncate">{value.text}</span>;
}

function FeedProperties({
  columns,
  coloredTags,
  label,
  locale,
  row,
  settings,
}: Pick<
  FeedCardProps,
  "columns" | "coloredTags" | "label" | "locale" | "row" | "settings"
>) {
  const items = settings.propertyColumnIds.flatMap((id) => {
    const column = columns.get(id);
    const value =
      column &&
      feedPropertyValue(column, feedValue(row, column), {
        locale,
        coloredTags,
        yes: label("yes"),
        no: label("no"),
      });
    return column && value ? [{ column, value }] : [];
  });
  if (!items.length) {
    return null;
  }
  return (
    <dl
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground text-xs"
      data-feed-properties
    >
      {items.map(({ column, value }) => (
        <div
          className="flex min-w-0 items-center gap-1.5"
          data-feed-property={column.id}
          key={column.id}
        >
          <dt className={settings.showPropertyLabels ? "shrink-0" : "sr-only"}>
            {column.header ?? column.id}
          </dt>
          <dd className="flex min-w-0 items-center">
            <PropertyValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One record as a feed post: title, author and date, body, media and properties. */
export function FeedCard(props: FeedCardProps) {
  const { columns, label, locale, now, onOpen, row, settings } = props;
  const titleId = useId();
  const column = (id?: string) => (id ? columns.get(id) : undefined);
  const titleColumn = column(settings.titleColumn);
  const rawTitle = feedValue(row, titleColumn);
  const title =
    rawTitle === null || rawTitle === undefined || rawTitle === ""
      ? label("untitled")
      : String(rawTitle);
  const dateColumn = column(settings.dateColumn);
  const date = dateColumn
    ? feedDate(
        feedValue(row, dateColumn),
        settings.dateDisplay,
        locale,
        dateColumn,
        now
      )
    : undefined;
  const author = feedAuthor(feedValue(row, column(settings.authorColumn)));
  const bodyColumn = column(settings.bodyColumn);
  const bodyValue = feedValue(row, bodyColumn);
  const bodyText = feedBodyText(bodyValue);
  const rendered =
    bodyColumn && props.renderBody && bodyText
      ? (props.renderBody(bodyValue, row) as ReactNode)
      : undefined;
  const compact = settings.density === "compact";
  return (
    <article
      aria-labelledby={titleId}
      aria-posinset={props.position}
      aria-setsize={props.setSize}
      className={cn(
        "grid min-w-0 rounded-lg border bg-card text-card-foreground shadow-xs",
        compact ? "gap-2 p-3" : "gap-3 p-4 sm:p-5"
      )}
      data-feed-card
      data-feed-item
      data-row-id={props.rowId}
    >
      <header className="grid min-w-0 gap-1.5">
        <h3
          className={cn(
            "min-w-0 font-semibold leading-snug",
            compact ? "text-sm" : "text-base"
          )}
          id={titleId}
        >
          <button
            className="max-w-full cursor-pointer break-words rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-feed-title
            onClick={(event) => onOpen(row, event)}
            type="button"
          >
            {title}
          </button>
        </h3>
        <FeedByline
          author={author}
          column={dateColumn}
          date={date}
          label={label}
        />
      </header>
      {bodyText ? (
        <FeedBody
          content={rendered}
          expanded={props.expanded}
          label={label}
          lines={settings.bodyLines}
          onToggle={() => props.onToggleExpanded(props.rowId)}
          text={bodyText}
        />
      ) : null}
      <FeedMediaBlock
        label={label}
        media={feedRowMedia(
          row,
          column(settings.mediaColumn),
          props.gallery,
          props.imageColumn
        )}
        title={title}
      />
      <FeedProperties {...props} />
    </article>
  );
}
