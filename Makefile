SHELL := /bin/bash

test:
	@mocha -R spec test.js

hint:
	@jshint index.js package.json lib/*

.PHONY: test hint
