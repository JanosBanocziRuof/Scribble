import { APIClient, Client, CustomizationMenu, ProfileMenu, Protocol, SettingsPanel } from "lib";
import { app, App, Layer } from "typings";
import { APIMap } from "../../../shared";
import Mod from "../api/Mod";
import Ninja from "../api/Ninja";
import { clickContainer } from "../utils";

enum HashPaths {
  menu = "",
  clans = "clans",
  game = "play",
  login = "login",
  mods = "mods",
  players = "players",
  profile = "profile",
  ranks = "ranks",
  recover = "recovery",
  register = "register",
  settings = "settings",
  shop = "shop",
}

export class UIURLMod extends Mod {
  constructor() {
    super({
      id: "UIURL",
      name: "UI URLs",
      description:
        "Saves your navigation state between page loads. Also enables joining a game via link.",
      author: "builtin",
      icon: "menu_icon_players",
      core: true,
    });
  }

  public load() {
    const menu = Ninja.activeMenu(),
      ProfilePaths = {
        [ProfileMenu.TAB_OVERVIEW]: "",
        [ProfileMenu.TAB_CLAN]: "clan",
        [ProfileMenu.TAB_ACCOUNT]: "account",
        [ProfileMenu.TAB_SETTINGS]: "settings",
      },
      ShopPaths = {
        [CustomizationMenu.PLAYER]: "self",
        [CustomizationMenu.WEAPONS]: "weapons",
      },
      SettingsPaths = {
        [SettingsPanel.Tabs.CONTROLS]: "controls",
        [SettingsPanel.Tabs.GRAPHICS]: "graphics",
        [SettingsPanel.Tabs.SOUND]: "sound",
        [SettingsPanel.Tabs.TEXTURES || "tex"]: "textures",
      };

    if (!window.location.hash.substring(1)) window.location.hash = "/";

    // Menu
    menu.addListener(Layer.Events.MENU_ACCESS, (m) =>
      this.switchHash(m == "mod" ? HashPaths.mods : HashPaths.menu)
    );
    // Profile
    let profCurTab = "";
    menu.on(Layer.Events.PROFILE_ACCESS, () =>
      this.switchHash(HashPaths.profile, ProfilePaths[profCurTab])
    );
    const openTab = App.Layer.profileMenu.openTab.bind(App.Layer.profileMenu);
    App.Layer.profileMenu.openTab = (tab, audio) => {
      openTab(tab, audio);
      profCurTab = tab;
      this.switchHash(HashPaths.profile, ProfilePaths[tab]);
    };
    // Shop
    menu.on(Layer.Events.CUSTOMIZATION_ACCESS, () =>
      this.switchHash(HashPaths.shop, ShopPaths[App.Layer.customizationMenu.display])
    );
    App.Layer.customizationMenu.playerCustomizationButton.on("mousedown", () =>
      this.switchHash(HashPaths.shop, ShopPaths[CustomizationMenu.PLAYER])
    );
    App.Layer.customizationMenu.weaponCustomizationButton.on("mousedown", () =>
      this.switchHash(HashPaths.shop, ShopPaths[CustomizationMenu.WEAPONS])
    );
    // Ranking
    menu.on(Layer.Events.RANKING_ACCESS, () => this.switchHash(HashPaths.ranks));
    // Players
    menu.on(Layer.Events.MEMBER_ACCESS, () => this.switchHash(HashPaths.players));
    // Clans
    menu.on(Layer.Events.CLAN_BROWSER_ACCESS, () => this.switchHash(HashPaths.clans));
    // Settings
    menu.on(Layer.Events.SETTINGS_ACCESS, () =>
      this.switchHash(
        HashPaths.settings,
        SettingsPaths[app.menu.settingsPanel.selectedTab || SettingsPanel.Tabs.CONTROLS]
      )
    );
    menu.on(<any>"open_tab", (tab: string) =>
      this.switchHash(HashPaths.settings, SettingsPaths[tab])
    );
    // Login / Signup / Recovery
    menu.on(Layer.Events.LOGIN_ACCESS, () => this.switchHash(HashPaths.login));
    menu.on(Layer.Events.REGISTER_ACCESS, () => this.switchHash(HashPaths.register));
    menu.on(Layer.Events.RECOVER_ACCESS, () => this.switchHash(HashPaths.recover));

    const curPath = window.location.hash.substring(2).split("/");
    switch (curPath[0]) {
      case HashPaths.profile: {
        menu.emit(Layer.Events.PROFILE_ACCESS);
        const profPath = Object.entries(ProfilePaths).find((p) => p[1] == curPath[1]);
        if (profPath) App.Layer.profileMenu.openTab(profPath[0], false);
        break;
      }
      case HashPaths.shop: {
        menu.emit(Layer.Events.CUSTOMIZATION_ACCESS);
        clickContainer(
          curPath[1] == ShopPaths[CustomizationMenu.WEAPONS]
            ? App.Layer.customizationMenu.weaponCustomizationButton
            : App.Layer.customizationMenu.playerCustomizationButton
        );
        break;
      }
      case HashPaths.ranks: {
        menu.emit(Layer.Events.RANKING_ACCESS);
        break;
      }
      case HashPaths.players: {
        menu.emit(<any>(Layer.Events.MEMBER_ACCESS + "f"));
        break;
      }
      case HashPaths.clans: {
        menu.emit(<any>(Layer.Events.CLAN_BROWSER_ACCESS + "f"));
        break;
      }
      case HashPaths.settings: {
        menu.emit(Layer.Events.SETTINGS_ACCESS);
        const settPath = Object.entries(SettingsPaths).find((p) => p[1] == curPath[1]);
        if (settPath) app.menu.settingsPanel.displayTab(settPath[0]);
        break;
      }
      case HashPaths.login: {
        menu.emit(Layer.Events.LOGIN_ACCESS);
        break;
      }
      case HashPaths.register: {
        menu.emit(Layer.Events.REGISTER_ACCESS);
        break;
      }
      case HashPaths.recover: {
        menu.emit(Layer.Events.RECOVER_ACCESS);
        break;
      }
      case HashPaths.mods: {
        menu.emit(<any>"modacc");
        break;
      }
    }

    this.hook();
    super.load();
  }

  public switchHash(path: HashPaths, ...extra: string[]) {
    return (window.location.hash = `/${[path, ...extra]
      .filter((e) => e)
      .map(encodeURIComponent)
      .join("/")}`);
  }

  public hook() {
    const mod = this;
    Client.prototype.onMessage = function (_a) {
      const a: any = Client.decompress(_a.data);
      try {
        /* Hooks into the join message and gets the server name you join using. */
        if (
          a.type == Protocol.SESSION &&
          a.data.type == Protocol.Session.JOIN_RESP &&
          a.data.info.startsWith("You joined ")
        ) {
          const roomName = a.data.info.substring("You joined ".length);
          window.location.hash =
            mod.switchHash(
              HashPaths.game,
              app.gameClient.server.id,
              roomName,
              Ninja.gamePassword || ""
            ) + "/";
        }
        const testMap = async (name: string) => {
          this.mapID = 0;
          const maps: APIMap[] = await APIClient.getMaps();
          const map = maps.find((m) => m.name == name);
          if (map) {
            this.mapID = Number(map.id);
            App.Console.log(`# Identified map as ${map.name} (ID: ${map.id}).`);
          } else
            App.Console.log(`# Failed to identify map. (name: ${name}) Please report to Meow.`);
        };
        if (a.type == Protocol.GAME && a.data.t == Protocol.Game.INFO) {
          if (a.data.msg.startsWith("Joining "))
            testMap((a.data.msg.match(/(?: - )(.*)(?: by)/) || [])[1]);
          else if (a.data.msg.startsWith("loading map: "))
            testMap(a.data.msg.substring("loading map: ".length));
        }
      } catch (err) {
        console.error(err);
      }
      this.dispatchEvent(a);
    };
  }
}
