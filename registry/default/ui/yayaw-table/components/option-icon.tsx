import { cn } from "@/lib/utils";
import { getOptionIconUrl, optionIconStyle } from "../utils/option-icon";

export function OptionIcon({
  className,
  option,
}: {
  className?: string;
  option: unknown;
}) {
  const url = getOptionIconUrl(option);
  if (!url) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 shrink-0 bg-current align-middle [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
        className
      )}
      data-yayaw-option-icon=""
      style={optionIconStyle(url)}
    />
  );
}
