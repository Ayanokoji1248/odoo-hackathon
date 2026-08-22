"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Heart, MessageCircle, MapPin, Share2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterToolbar } from "@/components/layout/FilterToolbar";
import type { CommunityPost } from "@/data/mock/community";

export function CommunityFeed({ posts }: { posts: CommunityPost[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popular");

  const filtered = useMemo(() => {
    return posts
      .filter((p) => {
        const q =
          !query ||
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.location.toLowerCase().includes(query.toLowerCase()) ||
          p.author.toLowerCase().includes(query.toLowerCase());
        const c = category === "all" || p.category === category;
        return q && c;
      })
      .sort((a, b) => (sort === "popular" ? b.likes - a.likes : b.comments - a.comments));
  }, [posts, query, category, sort]);

  return (
    <div>
      <FilterToolbar
        className="mb-6"
        query={query}
        onQueryChange={setQuery}
        placeholder="Search experiences, places, people…"
        groupBy={{ value: category, options: [{ label: "All", value: "all" }, { label: "Trips", value: "Trip" }, { label: "Activities", value: "Activity" }, { label: "Tips", value: "Tip" }], onChange: setCategory }}
        filterBy={{ value: category, options: [{ label: "All", value: "all" }, { label: "Trips", value: "Trip" }, { label: "Activities", value: "Activity" }, { label: "Tips", value: "Tip" }], onChange: setCategory }}
        sortBy={{ value: sort, options: [{ label: "Most liked", value: "popular" }, { label: "Most discussed", value: "comments" }], onChange: setSort }}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No posts found" description="Try a different search or filter." />
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
          {filtered.map((post) => (
            <article key={post.id} className="break-inside-avoid overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
              <div className="relative aspect-4/3 overflow-hidden">
                <Image src={post.imageUrl} alt={post.title} fill sizes="33vw" className="object-cover" />
                <div className="absolute left-3 top-3">
                  <Badge variant="primary">{post.category}</Badge>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <Avatar name={post.author} src={post.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{post.author}</p>
                    <p className="flex items-center gap-1 text-caption text-text-muted">
                      <MapPin className="h-3 w-3" /> {post.location} · {post.postedAt}
                    </p>
                  </div>
                </div>
                <h3 className="mt-3 text-h4 text-text-primary">{post.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{post.body}</p>
                <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-sm text-text-secondary">
                  <button className="flex items-center gap-1.5 hover:text-error"><Heart className="h-4 w-4" /> {post.likes}</button>
                  <button className="flex items-center gap-1.5 hover:text-primary"><MessageCircle className="h-4 w-4" /> {post.comments}</button>
                  <button className="ml-auto flex items-center gap-1.5 hover:text-primary"><Share2 className="h-4 w-4" /> Share</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
