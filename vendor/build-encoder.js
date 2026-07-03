// Build encoding/decoding for TerraSphere Build Editor

const BuildEncoder = {
  // Generate compact build code using mastery IDs (much shorter format)
  generateCompactBuildCode(state, baseURL = "https://terrarp.com/build/") {
    // Detect if we're currently on index.html to determine target page
    const currentPath = window.location.pathname;
    const isOnIndexPage =
      currentPath.includes("index.html") ||
      currentPath.endsWith("/") ||
      currentPath.includes("/");
    const targetPage = isOnIndexPage ? "index.html" : "build-sheet.html";
    // Load mastery data to get ID mappings (uses masteries)
    const masteryData = window.masteries || window.masterylist;
    if (!masteryData) {
      console.warn("Mastery data not loaded, using regular format");
      return this.generateJSONBuildCode(state, baseURL);
    }

    const {
      chosenMasteries,
      chosenMasteriesRanks,
      chosenExpertise,
      chosenExpertiseRanks,
      armorType,
      armorRank,
      accessoryType = null,
      accessoryRank = 0,
      weaponRank,
      chosenActions,
      characterName,
      characterRace,
      characterTitle,
      threadCode,
      ng = 0,
    } = state;

    // Convert mastery names to IDs (huge space savings!)
    const masteryIds = chosenMasteries
      .map((masteryName) => {
        const mastery = masteryData.find((m) => m.lookup === masteryName);
        return mastery ? mastery.id : 0;
      })
      .join(",");

    // Pack ranks into single string (55555 instead of 5,5,5,5,5)
    const rankString = chosenMasteriesRanks.join("");

    // Convert expertise names to IDs
    const expertiseData = window.expertise || window.expertiselist;
    const expertiseIds = chosenExpertise
      ? chosenExpertise
          .map((expertiseName) => {
            const expertise = expertiseData
              ? expertiseData.find((e) => e.lookup === expertiseName)
              : null;
            return expertise ? expertise.id : 0;
          })
          .join(",")
      : "";

    // Pack expertise ranks into single string
    const expertiseRankString = chosenExpertiseRanks
      ? chosenExpertiseRanks.join("")
      : "";

    // Single letter for armor type (h/m/l instead of heavy/medium/light)
    const armorShort = armorType ? armorType.charAt(0) : "";

    // Single letter for accessory type (c/u/m for combat/utility/magic)
    const accessoryShort = accessoryType ? accessoryType.charAt(0) : "";

    // Convert action names to IDs for even more space savings
    let actionCode = chosenActions.join(","); // fallback
    const actionData = window.actionlist;
    if (actionData) {
      const actionIds = chosenActions
        .map((actionName) => {
          const action = actionData.find((a) => a.lookup === actionName);
          return action ? action.id : 0;
        })
        .join(",");
      actionCode = actionIds;
    }

    // Only include character data if present (with prefixes to identify them)
    const charParts = [];
    if (characterName) charParts.push("n:" + characterName.replace(/ /gi, "_"));
    if (characterRace) charParts.push("r:" + characterRace.replace(/ /gi, "_"));
    if (characterTitle)
      charParts.push("t:" + characterTitle.replace(/ /gi, "_"));
    if (threadCode) charParts.push("c:" + threadCode.replace(/ /gi, "_"));
    if (state.note) charParts.push("note:" + encodeURIComponent(state.note));
    if (state.profileBannerUrl) {
      // Extract just the unique part from terrarp banner URLs to save space
      // From: https://terrarp.com/data/profile_banners/l/0/135.jpg?1718997316
      // To: 135.jpg?1718997316
      const bannerMatch = state.profileBannerUrl.match(
        /\/profile_banners\/[^\/]+\/[^\/]+\/(.+)$/,
      );
      const shortBanner = bannerMatch
        ? bannerMatch[1]
        : encodeURIComponent(state.profileBannerUrl);
      charParts.push("b:" + shortBanner);
    }
    if (state.avatarUrl) {
      charParts.push("a:" + encodeURIComponent(state.avatarUrl));
    }
    if (ng === 1) {
      charParts.push("ng:1");
    }

    const charData = charParts.join("&");

    // Create ultra-compact build string (new format with expertise and accessory)
    // NOTE: do NOT filter empty parts — the decoder uses fixed indices (0-10).
    // Filtering empty strings (e.g. actionCode when no actions are selected)
    // shifts charData from index 10 to 9 and it never gets decoded.
    const compactParts = [
      masteryIds,          // 0: mastery IDs
      rankString,          // 1: mastery ranks
      expertiseIds,        // 2: expertise IDs
      expertiseRankString, // 3: expertise ranks
      armorShort,          // 4: armor type
      armorRank,           // 5: armor rank
      accessoryShort,      // 6: accessory type
      accessoryRank,       // 7: accessory rank
      weaponRank,          // 8: weapon rank
      actionCode,          // 9: action IDs (may be empty — must stay to keep charData at index 10)
      charData,            // 10: character data
    ];

    const compactDetails = compactParts.join("|");

    // Always use #import for system
    const hashType = "#import.";

    // Encode (handle Unicode)
    const encodedBuild = btoa(
      encodeURIComponent(compactDetails).replace(
        /%([0-9A-F]{2})/g,
        (match, p1) => String.fromCharCode("0x" + p1),
      ),
    );
    return baseURL + targetPage + hashType + encodedBuild;
  },

  // Generate JSON-based build code (most compact and reliable)
  generateJSONBuildCode(state, baseURL = "https://terrarp.com/build/") {
    // Create clean build object with only necessary data
    const buildData = {
      chosenMasteries: state.chosenMasteries || [],
      chosenMasteriesRanks: state.chosenMasteriesRanks || [],
      chosenExpertise: state.chosenExpertise || [],
      chosenExpertiseRanks: state.chosenExpertiseRanks || [],
      armorType: state.armorType || null,
      armorRank: state.armorRank || 0,
      accessoryType: state.accessoryType || null,
      accessoryRank: state.accessoryRank || 0,
      weaponRank: state.weaponRank || 0,
      chosenActions: state.chosenActions || [],
      characterName: state.characterName || "",
      characterRace: state.characterRace || "",
      characterTitle: state.characterTitle || "",
      threadCode: state.threadCode || "",
      profileBannerUrl: state.profileBannerUrl || "",
      avatarUrl: state.avatarUrl || "",
      note: state.note || "",
    };

    // JSON stringify and base64 encode
    const jsonString = JSON.stringify(buildData);
    const encodedBuild = btoa(jsonString);

    // Detect target page
    const currentPath = window.location.pathname;
    const isOnIndexPage =
      currentPath.includes("index.html") ||
      currentPath.endsWith("/") ||
      currentPath.includes("/");
    const targetPage = isOnIndexPage ? "index.html" : "build-sheet.html";

    return baseURL + targetPage + "#import." + encodedBuild;
  },

  // Decode build string (JSON or Compact format only)
  decodeBuildString(encodedString) {
    // First try JSON format (most efficient)
    try {
      const decoded = atob(encodedString);
      const buildData = JSON.parse(decoded);

      // Validate that it's a proper build object
      if (
        buildData &&
        typeof buildData === "object" &&
        buildData.chosenMasteries
      ) {
        return buildData;
      }
    } catch (e) {
      // Not JSON format, try compact format
    }

    // Try compact format by looking for pipe delimiters in decoded string
    try {
      const decoded = atob(encodedString);
      if (decoded.includes("|")) {
        // If encodedString already has hash, use it as-is, otherwise add hash
        const compactInput = encodedString.startsWith("#")
          ? encodedString
          : "#import." + encodedString;
        const compactResult = this.decodeCompactBuildCode(compactInput);
        if (compactResult.success) {
          return compactResult.data;
        }
      }
    } catch (e) {
      // Not compact format either
    }

    throw new Error("only supports JSON and compact build formats");
  },

  // Decode compact build code
  decodeCompactBuildCode(encodedString) {
    try {
      // Handle compact format
      let cleanEncoded = encodedString;
      if (cleanEncoded.includes("#")) {
        const hashMatch = cleanEncoded.match(
          /#(?:compact-import|compact|import)\.(.+)$/,
        );
        if (hashMatch) {
          cleanEncoded = hashMatch[1];
        } else {
          return { success: false, error: "Not a compact build code" };
        }
      }

      // Decode base64 (handle Unicode)
      const decoded = decodeURIComponent(
        atob(cleanEncoded).replace(
          /./g,
          (char) => "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2),
        ),
      );
      const parts = decoded.split("|");

      // Determine format based on parts count
      const isNewFormat = parts.length >= 8; // has expertise fields
      const hasAccessory = parts.length >= 10; // with accessory has even more parts

      if (parts.length < 6) {
        throw new Error("Invalid compact build code format");
      }

      // Keep mastery IDs as IDs for optimal storage
      let chosenMasteries = [];
      let chosenMasteriesIds = []; // Store raw IDs
      const masteryData = window.masteries || window.masterylist;
      if (masteryData && parts[0]) {
        const masteryIds = parts[0].split(",").map((id) => parseInt(id));
        chosenMasteriesIds = masteryIds;

        // Convert to names for backward compatibility, but we'll prefer IDs
        chosenMasteries = masteryIds
          .map((id) => {
            const mastery = masteryData.find((m) => m.id === id);
            return mastery ? mastery.lookup : "";
          })
          .filter((name) => name);
      }

      // Unpack mastery ranks from single string - fix the parsing
      let chosenMasteriesRanks = [];
      if (parts[1]) {
        // Handle both single string format (443335) and comma-separated (4,4,3,3,3,5)
        if (parts[1].includes(",")) {
          chosenMasteriesRanks = parts[1]
            .split(",")
            .map((r) => parseInt(r) || 0);
        } else {
          // Split each character as a separate rank
          chosenMasteriesRanks = parts[1]
            .split("")
            .map((r) => parseInt(r) || 0);
        }
      }

      // Handle expertise (new format only)
      let chosenExpertise = [];
      let chosenExpertiseRanks = [];
      if (isNewFormat) {
        // Convert expertise IDs back to names
        const expertiseData = window.expertise || window.expertiselist;
        if (expertiseData && parts[2]) {
          const expertiseIds = parts[2].split(",").map((id) => parseInt(id));
          chosenExpertise = expertiseIds
            .map((id) => {
              const expertise = expertiseData.find((e) => e.id === id);
              return expertise ? expertise.lookup : "";
            })
            .filter((name) => name);
        }

        // Unpack expertise ranks from single string - fix the parsing
        if (parts[3]) {
          // Handle both single string format (345334) and comma-separated (3,4,5,3,3,4)
          if (parts[3].includes(",")) {
            chosenExpertiseRanks = parts[3]
              .split(",")
              .map((r) => parseInt(r) || 0);
          } else {
            // Split each character as a separate rank
            chosenExpertiseRanks = parts[3]
              .split("")
              .map((r) => parseInt(r) || 0);
          }
        }
      }

      // Fixed part indices
      const armorTypeIndex = 4;
      const armorRankIndex = 5;
      const accessoryTypeIndex = 6;
      const accessoryRankIndex = 7;
      const weaponRankIndex = 8;
      let actionIndex = 9;
      let charDataIndex = 10;

      // Backward-compat: older codes filtered empty actionCode, shifting charData to index 9.
      // Detect this by checking if parts[9] looks like charData rather than action IDs.
      if (
        !parts[charDataIndex] &&
        parts[actionIndex] &&
        /^(?:n:|r:|t:|b:|a:|c:|ng:|note:)/.test(parts[actionIndex])
      ) {
        actionIndex = -1;   // no actions
        charDataIndex = 9;
      }

      // Expand armor type
      const armorTypeMap = { h: "heavy", m: "medium", l: "light" };
      const armorType =
        armorTypeMap[parts[armorTypeIndex]] || parts[armorTypeIndex] || null;

      // Expand accessory type
      const accessoryTypeMap = { c: "combat", u: "utility", m: "magic" };
      const accessoryType = parts[accessoryTypeIndex]
        ? accessoryTypeMap[parts[accessoryTypeIndex]] ||
          parts[accessoryTypeIndex]
        : null;

      // Convert action IDs back to names
      let chosenActions = [];
      const actionData = window.actionlist || window.actionlist;
      if (actionIndex >= 0 && actionData && parts[actionIndex]) {
        const actionIds = parts[actionIndex]
          .split(",")
          .map((id) => parseInt(id));
        chosenActions = actionIds
          .map((id) => {
            const action = actionData.find((a) => a.id === id);
            return action ? action.lookup : "";
          })
          .filter((name) => name);
      } else if (actionIndex >= 0) {
        // Fallback for non-ID format
        chosenActions = parts[actionIndex]
          ? parts[actionIndex].split(",").filter((a) => a)
          : [];
      }

      // Parse character data
      let characterName = "",
        characterRace = "",
        characterTitle = "",
        threadCode = "",
        profileBannerUrl = "",
        avatarUrl = "",
        note = "",
        ng = 0;
      if (parts[charDataIndex]) {
        const charParts = parts[charDataIndex].split("&");
        charParts.forEach((part) => {
          if (part.startsWith("n:"))
            characterName = part.substring(2).replace(/_/gi, " ");
          if (part.startsWith("r:"))
            characterRace = part.substring(2).replace(/_/gi, " ");
          if (part.startsWith("t:"))
            characterTitle = part.substring(2).replace(/_/gi, " ");
          if (part.startsWith("c:"))
            threadCode = part.substring(2).replace(/_/gi, " ");
          if (part.startsWith("note:"))
            note = decodeURIComponent(part.substring(5));
          if (part.startsWith("a:"))
            avatarUrl = decodeURIComponent(part.substring(2));
          if (part.startsWith("ng:")) ng = parseInt(part.substring(3)) || 0;
          if (part.startsWith("b:")) {
            const shortBanner = part.substring(2);
            // Reconstruct full terrarp banner URL from shortened form
            // From: 135.jpg?1718997316
            // To: https://terrarp.com/data/profile_banners/l/0/135.jpg?1718997316
            if (shortBanner.includes(".jpg") || shortBanner.includes(".png")) {
              profileBannerUrl = `https://terrarp.com/data/profile_banners/l/0/${shortBanner}`;
            } else {
              // Fallback for non-standard URLs
              profileBannerUrl = decodeURIComponent(shortBanner);
            }
          }
        });
      }

      return {
        success: true,
        data: {
          chosenMasteries,
          chosenMasteriesRanks,
          chosenExpertise,
          chosenExpertiseRanks,
          armorType,
          armorRank: parseInt(parts[armorRankIndex]) || 0,
          accessoryType,
          accessoryRank: parseInt(parts[accessoryRankIndex]) || 0,
          weaponRank: parseInt(parts[weaponRankIndex]) || 0,
          chosenActions,
          characterName,
          characterRace,
          characterTitle,
          threadCode,
          profileBannerUrl,
          avatarUrl,
          note,
          ng,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: "Invalid compact build code: " + error.message,
      };
    }
  },

  // Load build from current URL hash
  loadFromURL() {
    const hash = window.location.hash;
    if (hash.includes("#import.")) {
      const buildCode = hash.slice(8); // Remove '#import.'
      try {
        const data = this.decodeBuildString(buildCode);
        return { success: true, data: data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: "No build code found in URL" };
  },

  // Generate short share code (for forum posts, etc.)
  generateShortCode(state) {
    const buildCode = this.generateJSONBuildCode(state, "");
    const encoded = buildCode.split(".").pop();
    return encoded.substring(0, 8).toUpperCase(); // First 8 characters as short code
  },

  // Create shareable URLs for different contexts
  generateShareURLs(state) {
    const baseCode = this.generateJSONBuildCode(state);

    return {
      full: baseCode,
      direct: baseCode.replace(
        /^(.*\/build\/)(?:index\.html)?(#\w+\..*)$/,
        "$1build-sheet.html$2",
      ),
      forum: `[url=${baseCode}]My Build[/url]`,
      discord: `Check out my build: ${baseCode}`,
    };
  },

  // Validate build code format
  validateBuildCode(encodedString) {
    try {
      const data = this.decodeBuildString(encodedString);

      // allows up to 6 masteries (vs 5 in V1)
      if (data.chosenMasteries.length > 6) {
        return {
          success: false,
          error: "Invalid build: Too many masteries selected (max 6)",
        };
      }

      // Validate rank count matches mastery count
      if (data.chosenMasteriesRanks.length !== data.chosenMasteries.length) {
        return {
          success: false,
          error: "Invalid build: Mastery and rank counts do not match",
        };
      }

      // Validate armor type
      if (
        data.armorType &&
        !["heavy", "medium", "light"].includes(data.armorType)
      ) {
        return {
          success: false,
          error: "Invalid build: Invalid armor type",
        };
      }

      // Validate accessory type
      if (
        data.accessoryType &&
        !["combat", "utility", "magic"].includes(data.accessoryType)
      ) {
        return {
          success: false,
          error: "Invalid build: Invalid accessory type",
        };
      }

      // Validate rank ranges
      const invalidRanks = data.chosenMasteriesRanks.some(
        (rank) => rank < 0 || rank > 5,
      );
      if (
        invalidRanks ||
        data.armorRank < 0 ||
        data.armorRank > 5 ||
        data.weaponRank < 0 ||
        data.weaponRank > 5 ||
        data.accessoryRank < 0 ||
        data.accessoryRank > 5
      ) {
        return {
          success: false,
          error: "Invalid build: Ranks must be between 0 and 5",
        };
      }

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: "Invalid build code: " + error.message,
      };
    }
  },
};

// Make available globally
window.BuildEncoder = BuildEncoder;
