import {
  defineComponent,
  reactive,
  ref,
  html,
  onMounted,
  onUnmounted,
} from "https://unpkg.com/@vue/lit@0.0.2";
import { ref as $ref } from "https://unpkg.com/lit-html/directives/ref.js?module";

const style = `
  ::-webkit-scrollbar {
      width: 4px;
      height: 4px;
  }
  ::-webkit-scrollbar-track {
      -webkit-box-shadow: inset 4px rgba(0, 0, 0, 0.3);
      border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb {
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.1);
      -webkit-box-shadow: inset 4px rgba(0, 0, 0, 0.5);
  }
  ::-webkit-scrollbar-thumb:window-inactive {
      background: rgba(0, 0, 0, 0.2);
  }
  .container {
      position: fixed;
      right: 1px;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      padding: 5px;
      margin: 24px;
      border: 1px solid #e9e9e9;
      font-size: 13px;
      color: rgba(13,27,62,.65);
      white-space: nowrap;
      text-overflow: ellipsis;
      transition: all ease 0.3s;
      z-index: 99;
  }
  .container--fold {
      opacity: 0.5;
  }
  .container--fold .content {
      opacity: 0;
      max-width: 0;
      max-height: 0;
      padding: 0;
  }
  .header {
    text-align: right;
    line-height: 1;
  }
  .content {
      margin: 0;
      padding: 0 10px 10px;
      max-width: 500px;
      max-height: 500px;
      overflow: auto;
      transition: all ease 0.3s;
  }
  .expand {
      cursor: pointer;
      font-style: normal;
      text-decoration: underline;
      margin-right: 5px;
  }
  .copy {
      cursor: pointer;
      text-decoration: underline;
  }
  .textarea {
      position: absolute;
      right: 0;
      bottom: -5px;
      border: none;
      opacity: 0;
      width: 0;
      height: 0;
  }
  .tips {
      display: none;
      position: absolute;
      right: 0;
      top: -10px;
      color: rgba(0, 0, 0, 0.2);
      text-shadow: 0px 1px rgba(255, 255, 255, 0.3);
      transform: translate3d(0, -50%, 0);
      animation: fadeIn 1.5s ease-in forwards;
  }
  .tips.show {
    display: block;
  }
  @keyframes fadeIn {
    0% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
`;

function camelcase(string, isUpperFirst = false) {
  let str = string
    .replace(/(^\s*[^a-zA-Z_$])|([^a-zA-Z_$\d])/g, " ")
    .replace(/^_[a-z]/g, (match) => match.toUpperCase())
    .replace(/_[a-z]/g, (match) => match.substr(1, match.length).toUpperCase())
    .replace(/([\d$]+[a-zA-Z])/g, (match) => match.toUpperCase())
    .replace(/\s+([a-zA-Z])/g, (match) => match.toUpperCase().trim())
    .replace(/\s/g, "");

  if (isUpperFirst) {
    return str.replace(/^[a-z]/, (_all, k) => k.toUpperCase());
  }

  return str;
}

const YAPI_GENERATOR_FOLD = "YAPI_GENERATOR_FOLD";
defineComponent("yapi-generator", () => {
  const observer = ref();
  const tipsRef = ref();
  const textareaRef = ref();
  const state = reactive({
    content: "",
    href: location.href,
    isFold: !!window.localStorage.getItem(YAPI_GENERATOR_FOLD),
  });

  const onFlod = () => {
    state.isFold = !state.isFold;
    window.localStorage.setItem("YAPI_GENERATOR_FOLD", state.isFold ? 1 : "");
  };

  const onCopy = () => {
    textareaRef.value.select();
    document.execCommand("copy");
    tipsRef.value.classList.add("show");
  };

  const onTipsAnimationend = () => {
    tipsRef.value.classList.remove("show");
  };

  function generator() {
    const [id] = state.href.match(/\b\d+$/g) || [];
    if (!/\/project\/\d+\/interface\/api\/\d+$/g.test(state.href) || !id) {
      state.content = "";
      return;
    }

    fetch(`/api/interface/get?id=${id}`, {
      method: "GET",
      mode: "cors",
      credentials: "include",
    })
      .then(async (res) => {
        const resJson = await res.json();
        const data = resJson.data || {};
        const query = (data.req_query || [])
          .map((it) => ({
            en: it.name,
            val: it.name === "page" ? 1 : it.name === "pageSize" ? 10 : "",
          }))
          .filter((it) => !["asc", "desc"].includes(it.en));
        const req_body_other = Object.keys(
          (data.req_body_other ? JSON.parse(data.req_body_other) : {})
            .properties || {}
        ).map((it) => ({ en: it, val: "" }));

        let params = (data.req_params || []).map((it) => ({
          en: it.name,
          val: "",
        }));
        let path = data.path;

        const splitIndex = data.path.indexOf("/{");
        if (splitIndex !== -1) {
          path = data.path.slice(0, splitIndex);
          params = data.path
            .slice(splitIndex)
            .split("/")
            .filter(Boolean)
            .map((it) => {
              const en = it.replace(/[{}]/g, "");
              return {
                en,
                val: it === en ? it : "",
              };
            });
        }
        const paths = data.path
          .split("/")
          .filter((it) => it && !it.includes("{"));
        const paramsList = params.map((it) => it.en);
        const queryList = query.map((it) => it.en);
        const inList = [].concat(query, params, req_body_other);
        const json = `{
            // ${state.href}
            // ${data.title}
            verb: "${data.method.toLocaleLowerCase()}",
            alias: "${camelcase(paths.slice(-2).join("_"))}",
            uri: "${path}",
            json: ${data.req_body_type === "json" ? "true" : "false"},
            ${inList.length ? "in: " + JSON.stringify(inList) + ",\n" : ""}
            ${
              paramsList.length
                ? "params: " + JSON.stringify(paramsList) + ",\n"
                : ""
            }
            ${
              queryList.length
                ? "query: " + JSON.stringify(queryList) + ",\n"
                : ""
            }
        }`;

        state.content = `${json
          .replace(/\n\s+/g, "\n  ")
          .replace(/,\s*\}$/, "\n}")}`;
      })
      .catch(() => {
        state.content = "";
      });
  }

  function init() {
    observer.value = new MutationObserver(function () {
      if (state.href === location.href) return;

      state.href = location.href;
      generator();
    });

    observer.value.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  onMounted(() => {
    init();
    generator();
  });

  onUnmounted(() => {
    observer.value.disconnect();
  });

  return () => html`
    <style>
      ${style}
    </style>
    <div class="container${state.isFold ? " container--fold" : ""}">
      <div class="header">
        <i class="expand" @click=${onFlod}>${state.isFold ? "展开" : "收起"}</i>
        <span class="copy" @click=${onCopy}>复制</span>
      </div>
      <pre class="content">${state.content}</pre>
      <textarea class="textarea" ${$ref(textareaRef)}>${state.content}</textarea>
      <div class="tips" ${$ref(tipsRef)} @animationend=${onTipsAnimationend}>
        复制成功
      </div>
    </div>
  `;
});

const app = document.createElement("yapi-generator");
document.body.appendChild(app);
