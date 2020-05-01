uwOptions = {
  placeholder: "Select...",
};
uwObserves = {};
events = {};
uwIntersectionObserver = new IntersectionObserver(function (entries) {
  // If intersectionRatio is 0, the target is out of view
  // and we do not need to do anything.
  for (let entry of entries) {
    if (entry.intersectionRatio <= 0) return;
    const node = entry.target;
    if (node.tagName !== "SELECT" || !node.dataset.uwId) continue;
    proceedSelect(node);
    uwIntersectionObserver.unobserve(node);
    delete window.uwObserves[node.dataset.uwId];
  }
});
uwMutationObserver = new MutationObserver(function (mutationsList) {
  for (let mutation of mutationsList) {
    if (mutation.type === "childList") {
      const { addedNodes, removedNodes } = mutation;
      const groupUpdates = {};
      for (let option of addedNodes) {
        const parent = option.parentElement;
        if (!groupUpdates[parent.dataset.uwId]) {
          groupUpdates[parent.dataset.uwId] = {
            added: [option],
            removed: [],
          };
        } else {
          groupUpdates[parent.dataset.uwId].added.push(option);
        }
      }
      for (let option of removedNodes) {
        const parent = option.dataset.parent;
        if (!parent) continue;
        if (!groupUpdates[parent]) {
          groupUpdates[parent] = {
            added: [],
            removed: [option],
          };
        } else {
          groupUpdates[parent].removed.push(option);
        }
      }
      Object.keys(groupUpdates).forEach((id) =>
        copyOptions(id, groupUpdates[id])
      );
    }
  }
});

function proceedSelect(target) {
  const config = { attributes: true, childList: true };
  buildSelect(target);
  uwMutationObserver.observe(target, config);
}
function watchSelect(target) {
  uwIntersectionObserver.observe(target);
}
function reduceSelects(nodes, initCheck = true) {
  const selects = [];
  for (let node of nodes) {
    if (node.tagName === "SELECT") {
      selects.push(node);
    } else if (typeof node.querySelectorAll === "function")
      selects.push(...node.querySelectorAll("select"));
  }
  if (initCheck) return selects.filter((el) => !el.dataset.uwInited);
  return selects;
}
function observeSelects(nodes) {
  for (node of nodes) {
    node.setAttribute("data-uw-inited", true);
    let id = `uw-at-${new Date().getTime()}-${parseInt(
      (Math.random() + 1) * 100
    )}`;
    node.setAttribute("data-uw-id", id);
    watchSelect(node);
    window.uwObserves[id] = true;
  }
}
function unobserveSelects(nodes) {
  for (node of nodes) {
    if (node.dataset.uwId) {
      uwIntersectionObserver.unobserve(node);
      delete window.uwObserves[node.dataset.uwId];
      const uwSelect = document.getElementById(node.dataset.uwId);
      if (uwSelect) destructSelect(uwSelect);
    }
  }
}
function observeBody() {
  const observer = new MutationObserver(function (mutationsList) {
    for (let mutation of mutationsList) {
      if (mutation.type === "childList") {
        const { addedNodes, removedNodes } = mutation;
        let selects = reduceSelects(addedNodes);
        observeSelects(selects);
        selects = reduceSelects(removedNodes, false);
        unobserveSelects(selects);
      }
    }
  });

  const config = { childList: true, subtree: true };
  observer.observe(document.body, config);
}
function runObserves() {
  observeSelects(document.querySelectorAll("select"));
  observeBody();
}
document.addEventListener("DOMContentLoaded", function () {
  runObserves();
});

function expandSelect(event) {
  if (this.getAttribute("aria-expanded") !== "true") {
    this.querySelector(".uw-select__options").classList.add("open");
    this.setAttribute("aria-expanded", true);
  } else {
    this.querySelector(".uw-select__options").classList.remove("open");
    this.setAttribute("aria-expanded", false);
  }
}
function handleSelect(event) {
  const parentId = this.dataset.parent;
  if (events[parentId].onSelect)
    events[parentId].onSelect({
      index: this.dataset.index,
      selected: this.dataset.selected,
      label: this.innerText,
      event,
    });
}

function buildSelect(source) {
  const { id, className, dataset, multiple, children, onchange } = source;
  const wrapper = document.createElement("div");
  wrapper.id = dataset.uwId;
  wrapper.className = `uw-select ${className}`;
  wrapper.style.display = "inline-block";
  wrapper.setAttribute("data-id", id);
  wrapper.setAttribute("data-multiple", multiple);
  wrapper.tabIndex = 0;
  wrapper.addEventListener("focus", expandSelect, false);
  wrapper.addEventListener("blur", expandSelect, false);

  const input = document.createElement("div");
  input.className = "input";
  input.innerText = uwOptions.placeholder;
  wrapper.append(input);

  events[dataset.uwId] = {
    onSelect: function ({ index, selected, label, event }) {
      if (input.innerText === uwOptions.placeholder) {
        input.innerText = label;
        options.children[index].setAttribute("data-selected", true);
      } else {
        if (multiple) {
          let selection = input.innerText.split(", ").filter((a) => a);
          if (selected) {
            selection = selection.filter((s) => s !== label);
            options.children[index].removeAttribute("data-selected");
          } else {
            selection.push(label);
            options.children[index].setAttribute("data-selected", true);
          }
          input.innerText =
            selection.length > 0 ? selection.join(", ") : uwOptions.placeholder;
        } else {
          if (!selected) {
            input.innerText = label;
            options
              .querySelector('[data-selected="true"]')
              .removeAttribute("data-selected");
            options.children[index].setAttribute("data-selected", true);
          }
        }
      }
      if (onchange) {
        if (multiple) {
          onchange(
            input.innerText === uwOptions.placeholder
              ? []
              : input.innerText.split(", ")
          );
        } else {
          onchange(
            options.querySelector('[data-selected="true"]').dataset.value
          );
        }
      }
      wrapper.blur();
    },
  };

  const options = document.createElement("div");
  options.className = "uw-select__options";

  for (let option of children) {
    const { value, innerText, selected } = option;

    option.setAttribute("data-parent", wrapper.id);
    option.setAttribute("data-index", option.index);

    const opt = document.createElement("div");
    if (selected) {
      if (input.innerText === uwOptions.placeholder) {
        input.innerText = innerText;
      } else {
        input.innerText = multiple
          ? `${input.innerText}, ${innerText}`
          : innerText;
      }
      opt.setAttribute("data-selected", true);
    }
    opt.className = "uw-select__option";
    opt.innerText = innerText;
    opt.setAttribute("data-parent", wrapper.id);
    opt.setAttribute("data-index", option.index);
    opt.setAttribute("data-value", value);
    opt.addEventListener("click", handleSelect, false);
    options.appendChild(opt);
  }
  wrapper.append(options);

  source.after(wrapper);
  source.classList.add("uw-hidden");
  source.tabIndex = -1;
}
function copyOptions(id, { added, removed }) {
  const uwSelect = document.getElementById(id);
  const options = uwSelect.querySelector(".uw-select__options");
  const origin = document.querySelector(`select[data-uw-id=${id}]`);

  for (let option of removed) {
    const index = option.dataset.index;
    const opt = options.children[index];
    opt.removeEventListener("click", handleSelect, false);
    options.removeChild(opt);
  }

  for (let option of added) {
    const { index, value, innerText } = option;

    option.setAttribute("data-parent", id);

    const opt = document.createElement("div");
    opt.className = "uw-select__option";
    opt.innerText = innerText;
    opt.setAttribute("data-parent", id);
    opt.setAttribute("data-value", value);
    opt.addEventListener("click", handleSelect, false);
    options.insertBefore(opt, options.children[index]);
  }

  for (let option of origin.children) {
    option.setAttribute("data-index", option.index);
    if (options.children[option.index])
      options.children[option.index].setAttribute("data-index", option.index);
  }
}
function destructSelect(target) {
  target.removeEventListener("focus", expandSelect, false);
  target.removeEventListener("blur", expandSelect, false);
  const { children } = target;
  for (let child of children) {
    child.removeEventListener("click", handleSelect, false);
  }
  target.parentNode.removeChild(target);
}
