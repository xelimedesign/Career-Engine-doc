/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CareerProvider, useCareer } from './store/CareerContext';
import { TopNav } from './components/TopNav';
import { CareerProfileModule } from './modules/CareerProfileModule';
import { JobTrackerModule } from './modules/JobTrackerModule';
import { ResumeBuilderModule } from './modules/ResumeBuilderModule';
import { CoverLetterModule } from './modules/CoverLetterModule';
import { ReviewCenterModule } from './modules/ReviewCenterModule';
import { DocumentManagerModule } from './modules/DocumentManagerModule';

function CareerEngineShell() {
  const { activeModule } = useCareer();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNav />
      <div className="flex-1 min-h-0">
        {activeModule === 'profile' && <CareerProfileModule />}
        {activeModule === 'jobs' && <JobTrackerModule />}
        {activeModule === 'resumes' && <ResumeBuilderModule />}
        {activeModule === 'cover-letters' && <CoverLetterModule />}
        {activeModule === 'review' && <ReviewCenterModule />}
        {activeModule === 'documents' && <DocumentManagerModule />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <CareerProvider>
      <CareerEngineShell />
    </CareerProvider>
  );
}
