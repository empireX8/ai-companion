import { UndoToastContainer } from "@/components/undo/UndoToastContainer";
import { DomainListProvider } from "@/components/layout/DomainListContext";
import { GlobalRailProvider } from "@/components/layout/GlobalRailContext";
import { AppShell } from "@/components/layout/AppShell";
import { InspectorProvider } from "@/components/inspector/InspectorContext";
import { MemoryInspectorDrawer } from "@/components/inspector/MemoryInspectorDrawer";

const RootGroupLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <GlobalRailProvider>
      <InspectorProvider>
        <DomainListProvider>
          <AppShell>{children}</AppShell>
        </DomainListProvider>
        <UndoToastContainer />
        <MemoryInspectorDrawer />
      </InspectorProvider>
    </GlobalRailProvider>
  );
};

export default RootGroupLayout;
