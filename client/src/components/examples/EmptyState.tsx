import EmptyState from "../EmptyState";

export default function EmptyStateExample() {
  return (
    <div className="h-screen bg-background">
      <EmptyState onExampleClick={(prompt) => console.log("Example clicked:", prompt)} />
    </div>
  );
}
