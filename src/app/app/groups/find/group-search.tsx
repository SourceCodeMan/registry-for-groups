"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { searchGroupsAction, requestJoinAction } from "@/lib/group-actions";
import type { GroupSearchResult } from "@/lib/groups";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function GroupSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GroupSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setResults(await searchGroupsAction(query));
        setSearched(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  function requestJoin(id: string) {
    start(async () => {
      const res = await requestJoinAction(id);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't send the request.");
        return;
      }
      setRequested((prev) => new Set(prev).add(id));
      toast.success("Request sent — the group admin will review it.");
    });
  }

  const showResults = q.trim().length >= 2;

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search by group name or admin email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />

      {showResults &&
        (loading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : results.length === 0 && searched ? (
          <p className="text-sm text-muted-foreground">
            No groups found. Double-check the name or email, or ask the admin
            for an invite link.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {results.map((g) => {
              const isReq = g.alreadyRequested || requested.has(g.id);
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{g.name}</span>
                    {g.adminName && (
                      <span className="truncate text-xs text-muted-foreground">
                        Admin: {g.adminName}
                      </span>
                    )}
                  </div>
                  {isReq ? (
                    <Button size="sm" variant="outline" disabled>
                      Requested
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => requestJoin(g.id)}
                    >
                      Request to join
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
