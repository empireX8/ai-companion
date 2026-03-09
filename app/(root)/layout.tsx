import { UndoToastContainer } from "@/components/undo/UndoToastContainer";
import { DomainListProvider } from "@/components/layout/DomainListContext";
import { GlobalRailProvider } from "@/components/layout/GlobalRailContext";
import { TopBarSlotProvider } from "@/components/layout/TopBarSlotContext";
import { AppShell } from "@/components/layout/AppShell";
import { InspectorProvider } from "@/components/inspector/InspectorContext";
import { MemoryInspectorDrawer } from "@/components/inspector/MemoryInspectorDrawer";
import { CommandPaletteProvider } from "@/components/command/CommandPaletteContext";
import { CommandPalette } from "@/components/command/CommandPalette";

const RootGroupLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <CommandPaletteProvider>
      <GlobalRailProvider>
        <InspectorProvider>
          <TopBarSlotProvider>
            <DomainListProvider>
              <AppShell>{children}</AppShell>
            </DomainListProvider>
          </TopBarSlotProvider>
          <UndoToastContainer />
          <MemoryInspectorDrawer />
        </InspectorProvider>
      </GlobalRailProvider>
      <CommandPalette />
    </CommandPaletteProvider>
  );
};

export default RootGroupLayout;
