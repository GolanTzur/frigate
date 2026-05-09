import ActivityIndicator from "@/components/indicators/activity-indicator";
import useApiFilter from "@/hooks/use-api-filter";
import { useCameraPreviews } from "@/hooks/use-camera-previews";
import { useTimezone } from "@/hooks/use-date-utils";
import { useOverlayState, useSearchEffect } from "@/hooks/use-overlay-state";
import { useUserPersistence } from "@/hooks/use-user-persistence";
import { FrigateConfig } from "@/types/frigateConfig";
import { RecordingStartingPoint } from "@/types/record";
import {
  RecordingsSummary,
  REVIEW_PADDING,
  ReviewFilter,
  ReviewSegment,
  ReviewSeverity,
  ReviewSummary,
  SegmentedReviewData,
} from "@/types/review";
import { TimelineType } from "@/types/timeline";
import {
  getBeginningOfDayTimestamp,
  getEndOfDayTimestamp,
} from "@/utils/dateUtil";
import EventView from "@/views/events/EventView";
import { RecordingView } from "@/views/recording/RecordingView";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

export default function Events() {
  const { t } = useTranslation(["views/events"]);

  const { data: config } = useSWR<FrigateConfig>("config", {
    revalidateOnFocus: false,
  });
  const timezone = useTimezone(config);

  // recordings viewer

  const [severity, setSeverity] = useOverlayState<ReviewSeverity>(
    "severity",
    "detection",
  );

  const [showReviewed, setShowReviewed] = useUserPersistence(
    "showReviewed",
    false,
  );

  const [recording, setRecording] = useOverlayState<RecordingStartingPoint>(
    "recording",
    undefined,
    false,
  );

  const [notificationTab, setNotificationTab] =
    useState<TimelineType>("timeline");

  useSearchEffect("tab", (tab: string) => {
    if (tab === "timeline" || tab === "events" || tab === "detail") {
      setNotificationTab(tab as TimelineType);
    }
    return true;
  });

  useSearchEffect("id", (reviewId: string) => {
    axios
      .get(`review/${reviewId}`)
      .then((resp) => {
        if (resp.status == 200 && resp.data) {
          const startTime = resp.data.start_time - REVIEW_PADDING;
          const date = new Date(startTime * 1000);

          setReviewFilter({
            after: getBeginningOfDayTimestamp(date),
            before: getEndOfDayTimestamp(date),
          });
          setRecording(
            {
              camera: resp.data.camera,
              startTime,
              severity: resp.data.severity,
              timelineType: notificationTab,
            },
            true,
          );
        }
      })
      .catch(() => {});

    return true;
  });

  const [startTime, setStartTime] = useState<number>();

  useEffect(() => {
    if (recording) {
      document.title = t("recordings.documentTitle");
    } else {
      document.title = t("documentTitle");
    }
  }, [recording, severity, t]);

  // review filter

  const [reviewFilter, setReviewFilter, reviewSearchParams] =
    useApiFilter<ReviewFilter>();

  useSearchEffect("cameras", (cameras: string) => {
    setReviewFilter({
      ...reviewFilter,
      cameras: cameras.includes(",") ? cameras.split(",") : [cameras],
    });
    return true;
  });

  useSearchEffect("labels", (labels: string) => {
    setReviewFilter({
      ...reviewFilter,
      labels: labels.includes(",") ? labels.split(",") : [labels],
    });
    return true;
  });

  useSearchEffect("zones", (zones: string) => {
    setReviewFilter({
      ...reviewFilter,
      zones: zones.includes(",") ? zones.split(",") : [zones],
    });
    return true;
  });

  useSearchEffect("group", (reviewGroup) => {
    if (config && reviewGroup && reviewGroup != "default") {
      const group = config.camera_groups[reviewGroup];
      const isBirdseyeOnly =
        group.cameras.length == 1 && group.cameras[0] == "birdseye";

      if (group && !isBirdseyeOnly) {
        setReviewFilter({
          ...reviewFilter,
          cameras: group.cameras,
        });
      }

      return true;
    }

    return false;
  });

  const onUpdateFilter = useCallback(
    (newFilter: ReviewFilter) => {
      setReviewFilter(newFilter);

      // update recording start time if filter
      // was changed on recording page
      if (recording != undefined && newFilter.after != undefined) {
        setRecording({ ...recording, startTime: newFilter.after }, true);
      }
    },
    [recording, setRecording, setReviewFilter],
  );

  // review paging

 const [beforeTs, setBeforeTs] = useState(Math.ceil(Date.now() / 1000));

// 🔥 freeze "after" ONCE
const initialAfter = useMemo(() => getHoursAgo(24), []);

const last24Hours = useMemo(() => {
  return { before: beforeTs, after: initialAfter };
}, [beforeTs, initialAfter]);

const selectedTimeRange = useMemo(() => {
  if (reviewSearchParams["after"] == undefined) {
    return {
      before: Math.floor(last24Hours.before),
      after: Math.floor(last24Hours.after),
    };
  }

  return {
    before: Math.floor(Number(reviewSearchParams["before"])),
    after: Math.floor(Number(reviewSearchParams["after"])),
  };
}, [last24Hours, reviewSearchParams]);

  // we want to update the items whenever the severity changes
  useEffect(() => {
    if (recording) {
      return;
    }

    const now = Date.now() / 1000;

    if (now - beforeTs > 60) {
      setBeforeTs(now);
    }

    // only refresh when severity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity]);

  const reviewSegmentFetcher = useCallback((key: string) => {
  console.log("FETCHING URL:", key);

  return axios.get(key).then((res) => {
    console.log("API RESPONSE:", res.data);
    return res.data;
  });
}, []);

  

const now = Math.floor(Date.now() / 1000);

// 🔥 renamed variables
// 🔥 normalize cameras correctly
// 🔥 FORCE CLEAN VALUES (no trust in params)

const selectedCameras =
  Array.isArray(reviewSearchParams["cameras"]) &&
  reviewSearchParams["cameras"].length > 0
    ? reviewSearchParams["cameras"].join(",")
    : "local_cam";

// 🔥 HARD clamp timestamps
const safeBefore = last24Hours.before;
const safeAfter = last24Hours.after;

// 🔥 build params safely (NO empty values)
const params = new URLSearchParams({
  reviewed: "1",
  before: String(safeBefore),
  after: String(safeAfter),
  cameras: selectedCameras,
});

console.log("selectedTimeRange:", selectedTimeRange);
console.log("before:", selectedTimeRange.before);
console.log("after:", selectedTimeRange.after);

const reviewKey =
  `review?reviewed=1` +
  `&before=${Math.floor(selectedTimeRange.before)}` +
  `&after=${Math.floor(selectedTimeRange.after)}` +
  `&cameras=local_cam`;

console.log("DIRECT reviewKey:", reviewKey);






/*const buildReviewKey = (summary?: ReviewSummary) => {
  console.log("buildReviewKey CALLED");

  const camVal =
    selectedCameras && selectedCameras.length > 0
      ? selectedCameras
      : "local_cam";

  if (!summary) {
    console.log("RETURNING NULL - no summary");
    return null;
  }

  console.log("REVIEW SUMMARY FULL:", summary);

  const firstGroup = Object.values(summary)[0];

  if (!firstGroup) {
    console.log("RETURNING NULL - no first group");
    return null;
  }

  const firstEntry = firstGroup;

  console.log("FIRST SUMMARY ENTRY:", firstEntry);

  const key =
    `review?reviewed=1` +
    `&before=${Math.floor(selectedTimeRange.before)}` +
    `&after=${Math.floor(selectedTimeRange.after)}` +
    `&cameras=${camVal}`;

  console.log("BACKEND reviewKey:", key);

  return key;
};


console.log("ACTUAL REVIEW KEY:", buildReviewKey());*/
// 🔥 SWR
const { data: reviews, mutate: updateSegments } =
  useSWR<ReviewSegment[]>(
    reviewKey,
    reviewSegmentFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );



console.log("REVIEWS FROM SWR:", reviews);


  const reviewItems = useMemo<SegmentedReviewData>(() => {
   if (!reviews) {
  return {
    all: [],
    alert: [],
    detection: [],
    significant_motion: [],
  };
}

    const all: ReviewSegment[] = [];
    const alerts: ReviewSegment[] = [];
    const detections: ReviewSegment[] = [];
    const motion: ReviewSegment[] = [];

    reviews?.forEach((segment) => {
      all.push(segment);

      switch (segment.severity) {
        case "alert":
          alerts.push(segment);
          break;
        case "detection":
          detections.push(segment);
          break;
        default:
          motion.push(segment);
          break;
      }
    }
  );

  console.log("REVIEWS RAW:", reviews);
console.log("BUILT REVIEW ITEMS:", {
  all,
  alert: alerts,
  detection: detections,
  significant_motion: motion,
});

    return {
      all: all,
      alert: alerts,
      detection: detections,
      significant_motion: motion,
    };
  }, [reviews]);

const currentItems = useMemo(() => {
  console.log("severity:", severity);
  console.log("showReviewed:", showReviewed);
  console.log("reviewItems:", reviewItems);

  if (!reviewItems || !severity) {
    console.log("NO reviewItems OR severity");

    return [];
  }

  let current: ReviewSegment[];

  if (reviewFilter?.showAll) {
    current = reviewItems.all;
  } else {
    current = reviewItems[severity];
  }

  console.log("CURRENT BEFORE FILTER:", current);

  if (!current || current.length === 0) {
    console.log("EMPTY CURRENT");

    return [];
  }

  // 🔥 IMPORTANT:
  // your only event currently has:
  // has_been_reviewed = true
  // so we force showing reviewed items
  return current;
}, [severity, reviewFilter, showReviewed, reviewItems]);

  // review summary

  // --- extract primitives ---
// --- normalize inputs safely ---
const camParam =
  Array.isArray(reviewSearchParams["cameras"]) &&
  reviewSearchParams["cameras"].length > 0
    ? reviewSearchParams["cameras"].join(",")
    : "local_cam";

const labelParam =
  Array.isArray(reviewSearchParams["labels"]) &&
  reviewSearchParams["labels"].length > 0
    ? reviewSearchParams["labels"].join(",")
    : null;

const zoneParam =
  Array.isArray(reviewSearchParams["zones"]) &&
  reviewSearchParams["zones"].length > 0
    ? reviewSearchParams["zones"].join(",")
    : null;

// ✅ fix timezone type
const tz =
  timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

const query = new URLSearchParams({
  timezone: tz,
  cameras: camParam,
});

if (labelParam) query.set("labels", labelParam);
if (zoneParam) query.set("zones", zoneParam);

const summaryKey = `review/summary?${query.toString()}`;

console.log("FIXED summaryKey:", summaryKey);

// --- SWR ---
const { data: summary, mutate: updateSummary } = useSWR<ReviewSummary>(
  summaryKey,
  {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    refreshInterval: 0,
  }
);
console.log("RAW reviewSummary:", summary);


  const reloadData = useCallback(() => {
    setBeforeTs(Date.now() / 1000);
    updateSummary();
  }, [updateSummary]);

  // recordings summary

  const selectedCamerasReview =
  reviewSearchParams["cameras"]?.length
    ? reviewSearchParams["cameras"].join(",")
    : "local_cam";

const recordingsSummaryKey = `recordings/summary?timezone=${timezone}&cameras=${selectedCamerasReview}`;

console.log("recordingsSummaryKey:", recordingsSummaryKey);

const { data: recordingsSummary } = useSWR<RecordingsSummary>(
  recordingsSummaryKey
);

  // preview videos
  const previewTimes = useMemo(() => {
    const startDate = new Date(selectedTimeRange.after * 1000);
    startDate.setUTCMinutes(0, 0, 0);

    const endDate = new Date(selectedTimeRange.before * 1000);
    endDate.setHours(endDate.getHours() + 1, 0, 0, 0);

    return {
      after: startDate.getTime() / 1000,
      before: endDate.getTime() / 1000,
    };
  }, [selectedTimeRange]);

  const allPreviews = useCameraPreviews(
    previewTimes ?? { after: 0, before: 0 },
    {
      fetchPreviews: previewTimes != undefined,
    },
  );

  // review status

  const markAllItemsAsReviewed = useCallback(
    async (currentItems: ReviewSegment[]) => {
      if (currentItems.length == 0) {
        return;
      }

      const severity = currentItems[0].severity;
      updateSegments(
        (data: ReviewSegment[] | undefined) => {
          if (!data) {
            return data;
          }

          const newData = [...data];

          newData.forEach((seg) => {
            if (seg.end_time && seg.severity == severity) {
              seg.has_been_reviewed = true;
            }
          });

          return newData;
        },
        { revalidate: false, populateCache: true },
      );

      const itemsToMarkReviewed = currentItems
        ?.filter((seg) => seg.end_time)
        ?.map((seg) => seg.id);

      if (itemsToMarkReviewed.length > 0) {
        await axios.post(`reviews/viewed`, {
          ids: itemsToMarkReviewed,
          reviewed: true,
        });
        reloadData();
      }
    },
    [reloadData, updateSegments],
  );

  const markItemAsReviewed = useCallback(
    async (review: ReviewSegment) => {
      const resp = await axios.post(`reviews/viewed`, {
        ids: [review.id],
        reviewed: true,
      });

      if (resp.status == 200) {
        updateSegments(
          (data: ReviewSegment[] | undefined) => {
            if (!data) {
              return data;
            }

            const reviewIndex = data.findIndex((item) => item.id == review.id);
            if (reviewIndex == -1) {
              return data;
            }

            const newData = [
              ...data.slice(0, reviewIndex),
              { ...data[reviewIndex], has_been_reviewed: true },
              ...data.slice(reviewIndex + 1),
            ];

            return newData;
          },
          { revalidate: false, populateCache: true },
        );

        updateSummary(
          (data: ReviewSummary | undefined) => {
            if (!data) {
              return data;
            }

            const day = new Date(review.start_time * 1000);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let key;
            if (day.getTime() > today.getTime()) {
              key = "last24Hours";
            } else {
              key = `${day.getFullYear()}-${("0" + (day.getMonth() + 1)).slice(-2)}-${("0" + day.getDate()).slice(-2)}`;
            }

            if (!Object.keys(data).includes(key)) {
              return data;
            }

            const item = data[key];
            return {
              ...data,
              [key]: {
                ...item,
                reviewed_alert:
                  review.severity == "alert"
                    ? item.reviewed_alert + 1
                    : item.reviewed_alert,
                reviewed_detection:
                  review.severity == "detection"
                    ? item.reviewed_detection + 1
                    : item.reviewed_detection,
              },
            };
          },
          { revalidate: false, populateCache: true },
        );
      }
    },
    [updateSegments, updateSummary],
  );

  // selected items

  const selectedReviewData = useMemo(() => {
    if (!recording) {
      return undefined;
    }

    if (!config) {
      return undefined;
    }

    if (!reviews) {
      return undefined;
    }

    setStartTime(recording.startTime);
    const allCameras = reviewFilter?.cameras ?? Object.keys(config.cameras);

    return {
      camera: recording.camera,
      start_time: recording.startTime,
      allCameras: allCameras,
    };

    // previews will not update after item is selected
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, reviews]);

  if (!timezone) {
    return <ActivityIndicator />;
  }

  if (recording) {
    if (selectedReviewData) {
      return (
        <RecordingView
          key={selectedTimeRange.before}
          startCamera={selectedReviewData.camera}
          startTime={selectedReviewData.start_time}
          allCameras={selectedReviewData.allCameras}
          reviewItems={reviews}
          reviewSummary={summary}
          allPreviews={allPreviews}
          timeRange={selectedTimeRange}
          filter={reviewFilter}
          updateFilter={onUpdateFilter}
          refreshData={reloadData}
        />
      );
    }
  } else {
    return (
      <EventView
        reviewItems={reviewItems}
        currentReviewItems={currentItems}
        reviewSummary={summary}
        recordingsSummary={recordingsSummary}
        relevantPreviews={allPreviews}
        timeRange={selectedTimeRange}
        filter={reviewFilter}
        severity={severity || "alert"}
        startTime={startTime}
        showReviewed={true}
        setShowReviewed={setShowReviewed}
        setSeverity={setSeverity}
        markItemAsReviewed={markItemAsReviewed}
        markAllItemsAsReviewed={markAllItemsAsReviewed}
        onOpenRecording={setRecording}
        pullLatestData={reloadData}
        updateFilter={onUpdateFilter}
        
      />
    );
  }
}


function getHoursAgo(hours: number): number {
  const now = new Date();
  now.setHours(now.getHours() - hours);
  return Math.ceil(now.getTime() / 1000);
}
