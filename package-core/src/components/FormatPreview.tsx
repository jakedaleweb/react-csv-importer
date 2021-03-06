import React, { useMemo, useRef, useEffect, useState } from 'react';

import {
  parsePreview,
  PreviewResults,
  PreviewInfo,
  CustomizablePapaParseConfig
} from './parser';
import { ImporterFrame } from './ImporterFrame';
import { FormatRawPreview } from './FormatRawPreview';
import { FormatDataRowPreview } from './FormatDataRowPreview';
import { FormatErrorMessage } from './FormatErrorMessage';

import './FormatPreview.scss';

export const FormatPreview: React.FC<{
  customConfig: CustomizablePapaParseConfig;
  file: File;
  assumeNoHeaders?: boolean;
  currentPreview: PreviewInfo | null;
  onAccept: (preview: PreviewInfo) => void;
  onCancel: () => void;
}> = ({
  customConfig,
  file,
  assumeNoHeaders,
  currentPreview,
  onAccept,
  onCancel
}) => {
  const [preview, setPreview] = useState<PreviewResults | null>(
    () =>
      currentPreview && {
        parseError: undefined,
        ...currentPreview
      }
  );

  // wrap in ref to avoid triggering effect
  const customConfigRef = useRef(customConfig);
  customConfigRef.current = customConfig;
  const assumeNoHeadersRef = useRef(assumeNoHeaders);
  assumeNoHeadersRef.current = assumeNoHeaders;

  // perform async preview parse
  const asyncLockRef = useRef<number>(0);
  useEffect(() => {
    const oplock = asyncLockRef.current;

    parsePreview(file, customConfigRef.current).then((results) => {
      // ignore if stale
      if (oplock !== asyncLockRef.current) {
        return;
      }

      if (results.parseError) {
        setPreview(results);
      } else {
        // pre-fill headers flag (only possible with >1 lines)
        const hasHeaders = !assumeNoHeadersRef.current && !results.isSingleLine;

        setPreview({ ...results, hasHeaders });
      }
    });

    return () => {
      // invalidate current oplock on change or unmount
      asyncLockRef.current += 1;
    };
  }, [file]);

  const report = useMemo(() => {
    if (!preview) {
      return null;
    }

    if (preview.parseError) {
      return (
        <div className="CSVImporter_FormatPreview__mainResultBlock">
          <FormatErrorMessage onCancelClick={onCancel}>
            Import error: <b>{preview.parseError.message}</b>
          </FormatErrorMessage>
        </div>
      );
    }

    return (
      <div className="CSVImporter_FormatPreview__mainResultBlock">
        <div className="CSVImporter_FormatPreview__header">
          Raw File Contents
        </div>

        <FormatRawPreview
          chunk={preview.firstChunk}
          warning={preview.parseWarning}
          onCancelClick={onCancel}
        />

        {preview.parseWarning ? null : (
          <>
            <div className="CSVImporter_FormatPreview__header">
              Preview Import
              {!preview.isSingleLine && ( // hide setting if only one line anyway
                <label className="CSVImporter_FormatPreview__headerToggle">
                  <input
                    type="checkbox"
                    checked={preview.hasHeaders}
                    onChange={() => {
                      setPreview((prev) =>
                        prev && !prev.parseError // appease type safety
                          ? {
                              ...prev,
                              hasHeaders: !prev.hasHeaders
                            }
                          : prev
                      );
                    }}
                  />
                  <span>Data has headers</span>
                </label>
              )}
            </div>
            <FormatDataRowPreview
              hasHeaders={preview.hasHeaders}
              rows={preview.firstRows}
            />
          </>
        )}
      </div>
    );
  }, [preview, onCancel]);

  return (
    <ImporterFrame
      fileName={file.name}
      nextDisabled={!preview || !!preview.parseError || !!preview.parseWarning}
      onNext={() => {
        if (!preview || preview.parseError) {
          throw new Error('unexpected missing preview info');
        }

        onAccept(preview);
      }}
      onCancel={onCancel}
    >
      {report || (
        <div className="CSVImporter_FormatPreview__mainPendingBlock">
          Loading preview...
        </div>
      )}
    </ImporterFrame>
  );
};
