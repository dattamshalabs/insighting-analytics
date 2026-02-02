"use client";

import { useCallback, useState } from "react";

import { api } from "@/lib/api";
import type { SchemaMap } from "@/types";

export function useSchemaMap() {
  const [schema, setSchema] = useState<SchemaMap | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (datasourceId: string) => {
    setLoading(true);
    try {
      setSchema(await api.getSchema(datasourceId));
    } catch {
      setSchema(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { schema, loading, load };
}
