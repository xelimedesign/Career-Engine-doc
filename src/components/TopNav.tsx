import { AppModule } from '../types/career';
import { useCareer } from '../store/CareerContext';

const NAV_ITEMS: Array<{ id: AppModule; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'resumes', label: 'Resumes' },
  { id: 'cover-letters', label: 'Cover Letters' },
  { id: 'review', label: 'Review' },
  { id: 'documents', label: 'Documents' },
];

export function TopNav() {
  const { activeModule, setActiveModule, createResume, createCoverLetter } = useCareer();

  const handlePrimaryAction = () => {
    if (activeModule === 'cover-letters') {
      createCoverLetter({ prefillFromProfile: true });
    } else if (activeModule === 'jobs') {
      setActiveModule('jobs');
      window.dispatchEvent(new CustomEvent('career-engine:new-job'));
    } else {
      createResume({ fromProfile: true });
      setActiveModule('resumes');
    }
  };

  const primaryLabel =
    activeModule === 'cover-letters'
      ? 'New Cover Letter'
      : activeModule === 'jobs'
        ? 'Add Job'
        : 'New Resume';

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single-line Brand Wordmark */}
      <button
        type="button"
        onClick={() => setActiveModule('resumes')}
        className="font-ui text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        Career Engine
      </button>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav aria-label="Primary" className="flex items-center gap-6 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModule(item.id)}
              className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900 ${
                isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {item.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single Primary Action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={handlePrimaryAction}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          {primaryLabel}
        </button>
      </div>
    </header>
  );
}
