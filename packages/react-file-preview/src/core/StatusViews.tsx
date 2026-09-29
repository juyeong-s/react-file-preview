import type { ErrorSlotProps, LoadingSlotProps, UnsupportedSlotProps } from './types';
import { formatBytes } from './utils';
import { defaultIcons } from '../ui/icons';

export function LoadingView({ progress, messages }: LoadingSlotProps) {
  return (
    <div className="fp-status" role="status" aria-live="polite">
      <div className="fp-spinner" aria-hidden="true" />
      <div className="fp-status-text">
        {messages.loading}
        {progress != null && ` ${Math.round(progress * 100)}%`}
      </div>
      {progress != null && (
        <div className="fp-progress" aria-hidden="true">
          <div className="fp-progress-bar" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}

export function ErrorView({ error, retry, download, messages }: ErrorSlotProps) {
  return (
    <div className="fp-status" role="alert">
      <div className="fp-status-icon" data-tone="error">
        {defaultIcons.error}
      </div>
      <div className="fp-status-title">{messages.errorTitle}</div>
      <div className="fp-status-text">{error.message}</div>
      <div className="fp-status-actions">
        <button type="button" className="fp-status-button" onClick={retry}>
          {messages.retry}
        </button>
        {download && (
          <button type="button" className="fp-status-button" data-variant="secondary" onClick={download}>
            {messages.download}
          </button>
        )}
      </div>
    </div>
  );
}

export function UnsupportedView({ file, download, messages }: UnsupportedSlotProps) {
  return (
    <div className="fp-status">
      <div className="fp-status-icon">{defaultIcons.file}</div>
      {file && (
        <div className="fp-status-file">
          <span className="fp-status-file-name">{file.name}</span>
          {file.size != null && <span className="fp-status-file-size">{formatBytes(file.size)}</span>}
        </div>
      )}
      <div className="fp-status-title">{messages.unsupportedTitle}</div>
      <div className="fp-status-text">{messages.unsupportedDescription}</div>
      {file && (
        <button type="button" className="fp-status-button" onClick={download}>
          {messages.download}
        </button>
      )}
    </div>
  );
}
