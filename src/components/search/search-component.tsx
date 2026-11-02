"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HERO_CONTENT } from "@/data/hero";

export function SearchComponent() {
  const { search } = HERO_CONTENT;

  return (
    <>
      <form
        action="/catalogo"
        method="GET"
        className="mx-auto mt-8 block max-w-sm px-4"
      >
        <div className="bg-card flex gap-2 rounded-lg p-4 shadow-sm">
          <div className="relative flex-1">
            <Input
              name="search"
              placeholder={search.placeholder}
              className="text-foreground"
            />
          </div>

          <Button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-6"
          >
            <Search className="size-5" />
          </Button>
        </div>
      </form>
    </>
  );
}
