import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/types";
import { api } from "@/lib/api";

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      // Public view: roster without email
      const { data, error } = await supabase.from("students_public" as any).select("*").order("name");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, email: null })) as Student[];
    },
  });
}

export function useStudentById(student_id: string | null) {
  return useQuery({
    queryKey: ["students", "by-student-id", student_id],
    enabled: !!student_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students_public" as any)
        .select("*")
        .eq("student_id", student_id!)
        .maybeSingle();
      if (error) throw error;
      return data ? ({ ...(data as any), email: null } as Student) : null;
    },
  });
}

export function useUpsertStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      s: Partial<Student> & { student_id: string; name: string; section: string },
    ) => {
      const res = await api.students.upsert(s as any);
      return res.student as Student;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useDeleteStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await api.students.delete(ids);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useBulkInsertStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rows: Array<Partial<Student> & { student_id: string; name: string; section: string }>,
    ) => {
      const res = await api.students.bulkUpsert(rows as any);
      return res.students as Student[];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}
