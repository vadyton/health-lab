import { UiStore }        from "./UiStore";
import { DashboardStore } from "./DashboardStore";
import { HeartRateStore } from "./HeartRateStore";
import { StepsStore }     from "./StepsStore";
import { SleepStore }     from "./SleepStore";
import { BodyStore }      from "./BodyStore";
import { AuthStore }      from "./AuthStore";

export class RootStore {
  ui        = new UiStore();
  auth      = new AuthStore();
  dashboard = new DashboardStore();
  heartRate = new HeartRateStore();
  steps     = new StepsStore();
  sleep     = new SleepStore();
  body      = new BodyStore();
}

export const rootStore = new RootStore();
