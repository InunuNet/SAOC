// form-controls-16px-r71: server-renders components/events/SubmitEventForm to static HTML on stdout (run through `pnpm exec tsx`). /events/submit
// shows the form only to a member session, which the checks never forge, so _walk.mjs loads this markup in the browser against the real built
// stylesheets instead. QA input, hash-locked. Reads nothing, writes nothing.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SubmitEventForm } from '../../../../../../components/events/SubmitEventForm.tsx';

process.stdout.write(renderToStaticMarkup(createElement(SubmitEventForm)));
