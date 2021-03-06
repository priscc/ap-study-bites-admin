import { vuexfireMutations, firestoreAction } from "vuexfire";
import { getField, updateField } from "vuex-map-fields";
import { db } from "../../firebase/db";
import { getIdFromURL } from "vue-youtube-embed";

const resourcesRef = db.collection("resources");

export default {
  namespaced: true,
  state: {
    videos: [],
    videoID: null,
    videoURL: null,
    contentID: null,
    currentVideoResource: {
      parentID: "",
      parentType: "",
      resourceType: "",
      url: "",
      title: "",
      topicID: [],
      searchArray: [],
    },
  },
  getters: {
    getField,
    currentVideos: (state) => state.videos,
    currentVideoURL: (state) => getIdFromURL(state.videoURL),
  },
  actions: {
    bindTopics: firestoreAction(({ bindFirestoreRef }) => {
      // return the promise returned by `bindFirestoreRef`
      return bindFirestoreRef("resources", db.collection("resources"));
    }),

    //* fetches all videos under topics
    async fetchVideos({ commit, rootState }, parentType) {
      let videoList = [];

      await resourcesRef
        .where("topicID", "array-contains-any", [rootState.topics.topicID])
        .where("parentType", "==", parentType)
        .where("resourceType", "==", "video")
        .get()
        .then(async (querySnapshot) => {
          querySnapshot.docs.map((doc) => {
            let videoItem = doc.data();

            //* appends unique video id to each work
            videoList.push({
              ...videoItem,
              id: doc.id,
            });
          });
          await commit("SET_VIDEOS", videoList);
        });
      // console.log("fetchVideos", state.videos);
    },

    //* fetches all video resources under topic contents
    async fetchContentVideos({ state, commit, rootState }, parentType) {
      const readParentID = (parentType) => {
        if (parentType == "event") {
          console.log("1) eventID (video):", rootState.events.eventId);
          return rootState.events.eventId;
        } else if (parentType == "people") {
          console.log("1) personId (person):", rootState.people.personId);
          return rootState.people.personId;
        }
      };
      let parentID = await readParentID(parentType);
      let videos = [];
      await resourcesRef
        .where("parentID", "==", parentID)
        .where("parentType", "==", parentType)
        .where("resourceType", "==", "video")
        .get()
        .then((querySnapshot) => {
          querySnapshot.docs.map((doc) => {
            console.log("2) fetching videos:", parentID);
            let videoItem = doc.data();
            videos.push({
              ...videoItem,
              id: doc.id,
            });
          });
        });
      await commit("SET_VIDEOS", videos);
      console.log("3) fetched videos:", state.articles);
    },

    //* clears video resource form
    clearVideoForm({ commit }) {
      commit("SET_CURRENT_VIDEO_RESOURCE", {
        parentID: "",
        parentType: "",
        resourceType: "video",
        url: "",
        title: "",
        topicID: [],
        searchArray: [],
      });
      commit("SET_YOUTUBE_ID", "");
      // console.log(state.currentVideoResource);
    },

    //* handles submit video resource
    async submitNewVideo({ state, commit, dispatch, rootState }, parentType) {
      let url = getIdFromURL(state.videoURL);
      commit("SET_YOUTUBE_URL", url);

      //* sets parentID
      const readParentID = (parentType) => {
        if (parentType == "event") {
          return rootState.events.eventId;
        } else if (parentType == "people") {
          return rootState.people.personId;
        } else if (parentType == "topic") {
          return rootState.topics.topicID;
        }
      };
      let parentID = await readParentID(parentType);
      commit("SET_VIDEO_PROPS", {
        parentID: parentID,
        parentType: parentType,
      });
      commit("SET_VIDEO_TOPIC_ID", rootState.topics.topicID);
      commit("SET_SEARCH_ARRAY", state.currentVideoResource.title);

      if (parentID) {
        console.log("4) video has parentID");

        //* adds new video to firestore
        await resourcesRef.add(state.currentVideoResource).then(() => {
          console.log("4) Submitted Video Resource");
        });
      } else {
        console.log("4) video does not have parentID");
      }
      commit("UPDATE_VIDEOS");
      console.log("4) new video:", state.currentArticle);
      console.log("5) videos", state.articles);
      dispatch("clearVideoForm");
      // alert("Submitted Video Resource");
    },

    async addVideoToDB({ state }) {
      if (state.videos.length > 0) {
        var batch = db.batch();
        state.videos.forEach((doc) => {
          var docRef = resourcesRef.doc(); //automatically generate unique id
          batch.set(docRef, doc);
        });
        batch.commit();
        console.log("9) Submitted Videos:", state.videos);
      }
    },

    //* sets current video for edit
    editVideo({ commit, state }, video) {
      commit("SET_VIDEO_ID", video.id);

      //* returns the index of the video for edit
      let index = state.videos.findIndex((e) => e.id == video.id);

      //* identifies the current video for edit using index
      let currentVideo = state.videos[index];
      commit("SET_CURRENT_VIDEO_RESOURCE", currentVideo);
      commit("SET_YOUTUBE_ID", currentVideo.url);
    },

    //* submit edit video
    async submitEditVideo({ state, dispatch, commit }) {
      let url = getIdFromURL(state.videoURL);
      commit("SET_YOUTUBE_URL", url);
      commit("UPDATE_SEARCH_ARRAY", state.currentVideoResource.title);
      await resourcesRef
        .doc(state.videoID)
        .set(state.currentVideoResource, { merge: true })
        .then(() => {
          console.log("Submit Edit for " + state.currentVideoResource.title);
        });
      dispatch("clearVideoForm");
    },

    //* delete video
    async deleteVideo({ state, commit, dispatch }, video) {
      await commit("SET_VIDEO_ID", video.id);
      await resourcesRef
        .doc(state.videoID)
        .delete()
        .then(() => {
          console.log("Successfully deleted");
        });
      commit("SET_VIDEO_ID", null);
      dispatch("clearVideoForm");
    },
  },
  mutations: {
    ...vuexfireMutations,
    updateField,
    SET_VIDEOS: (state, videos) => (state.videos = videos),
    SET_VIDEO_ID: (state, id) => (state.videoID = id),
    SET_YOUTUBE_URL: (state, url) => (state.currentVideoResource.url = url),
    SET_YOUTUBE_ID: (state, id) => (state.videoURL = id),
    SET_VIDEO_PROPS: (state, props) =>
      (state.currentVideoResource = {
        ...state.currentVideoResource,
        ...props,
      }),
    SET_VIDEO_TOPIC_ID: (state, id) => {
      state.currentVideoResource.topicID.push(id);
    },
    SET_SEARCH_ARRAY: (state, array) => {
      //* splits the words into strings and stores in newArray
      let newArray = array.split(" ");
      state.currentVideoResource.searchArray.push(...newArray);
    },
    SET_CURRENT_VIDEO_RESOURCE: (state, fields) =>
      (state.currentVideoResource = fields),
    UPDATE_SEARCH_ARRAY: (state, array) => {
      let newArray = array.split(" ");
      state.currentVideoResource.searchArray = newArray;
    },
    UPDATE_VIDEOS: (state) => state.videos.push(state.currentVideoResource),
    UPDATE_VIDEOS_ID: (state, id) => {
      state.videos.forEach(function(video) {
        video.parentID = id;
      });
      console.log("8) update videos with eventids:", state.videos);
    },
  },
};
