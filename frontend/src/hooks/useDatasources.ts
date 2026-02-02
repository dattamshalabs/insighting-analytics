"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Datasource, DatasourceCreate } from "@/types";

export function useDatasources() {
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDatasources(await api.getDatasources());
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (data: DatasourceCreate) => {
      const ds = await api.createDatasource(data);
      await refresh();
      return ds;
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await api.deleteDatasource(id);
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { datasources, loading, refresh, create, remove };
}
