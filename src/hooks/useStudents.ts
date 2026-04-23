import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/types";

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("name");
      if (error) throw error;
      return data as Student[];
    },
  });
}

export function useStudentById(student_id: string | null) {
  return useQuery({
    queryKey: ["students", "by-student-id", student_id],
    enabled: !!student_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("student_id", student_id!).maybeSingle();
      if (error) throw error;
      return data as Student | null;
    },
  });
}

export function useUpsertStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<Student> & { student_id: string; name: string; section: string }) => {
      const { data, error } = await supabase.from("students").upsert(s as any, { onConflict: "student_id" }).select().single();
      if (error) throw error;
      return data as Student;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useDeleteStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("students").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useBulkInsertStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Array<Partial<Student> & { student_id: string; name: string; section: string }>) => {
      const { error, data } = await supabase.from("students").upsert(rows as any, { onConflict: "student_id" }).select();
      if (error) throw error;
      return data as Student[];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}
