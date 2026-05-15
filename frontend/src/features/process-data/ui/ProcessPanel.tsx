import { useRef, useEffect } from "react";
import { useProcess } from "../model/useProcess";
import s from "./ProcessPanel.module.scss";

export function ProcessPanel() {
  const { running, log, run, stop } = useProcess();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  return (
    <div className={s.panel}>
      <div className={s.controls}>
        {running ? (
          <button className={s.btnStop} onClick={stop}>■ Стоп</button>
        ) : (
          <button className={s.btnRun} onClick={() => run()}>
            ▶ Обработать
          </button>
        )}
      </div>

      {log.length > 0 && (
        <div className={s.log} ref={logRef}>
          {log.map((line, i) => (
            <div key={i} className={`${s.line} ${s[line.type]}`}>
              {line.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
