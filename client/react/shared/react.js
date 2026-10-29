// React and ReactDOM are loaded by the page as globals (/vendor), so every component uses that one copy
export const React = window.React;
export const ReactDOM = window.ReactDOM;
export const { useState, useEffect, useRef, useCallback } = window.React;
