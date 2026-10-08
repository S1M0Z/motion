import Studio from '@/components/Studio';
import { aiConfig } from '@/lib/server/ai-provider';
export const dynamic = 'force-dynamic';
export default function Page() {
  const { engine, requestedProvider } = aiConfig();
  return <Studio aiEngine={engine} requestedProvider={requestedProvider}/>;
}
