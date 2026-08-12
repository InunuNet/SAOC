import type { Foo } from '@/types';
export const revalidate = 60;
export default async function Page(): Promise<null> {
  const x: Foo | null = null;
  return x as null;
}
