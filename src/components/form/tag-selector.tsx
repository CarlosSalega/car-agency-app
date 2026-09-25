import type { Tag } from "@prisma/client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTagName } from "@/lib/tag-utils";

interface TagSelectorProps {
  tags: Tag[];
  selectedTags: string[];
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
}

export function TagSelector({
  tags,
  selectedTags,
  onAddTag,
  onRemoveTag,
}: TagSelectorProps) {
  return (
    <div className="space-y-2">
      <Select
        value=""
        onValueChange={(value) => {
          if (value) onAddTag(value);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Agregar tag" />
        </SelectTrigger>
        <SelectContent>
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              {formatTagName(tag.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((id) => {
          const tag = tags.find((t) => t.id === id);
          if (!tag) return null;
          return (
            <span
              key={id}
              className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm"
              style={{
                background: tag.color || "#111827",
                color: "#fff",
              }}
            >
              {formatTagName(tag.name)}
              <button
                type="button"
                onClick={() => onRemoveTag(id)}
                className="ml-1 text-xs opacity-80"
              >
                ✕
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
