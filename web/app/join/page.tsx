import { TopBar } from "@/components/bars";
import { CodeForm } from "@/components/join";

export default function Join() {
  return (
    <>
      <TopBar back="/" title="Join event" />
      <CodeForm />
    </>
  );
}
