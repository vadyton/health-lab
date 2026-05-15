import { BaseApi } from "@/shared/api/BaseApi";
import type { UserProfile } from "../model/types";

class ProfileApi extends BaseApi {
  getProfile = () =>
    this.get<UserProfile>("/api/profile");

  save = (profile: UserProfile) =>
    this.put<{ ok: boolean }>("/api/profile", profile);
}

export const profileApi = new ProfileApi();
