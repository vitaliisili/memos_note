.PHONY: install build clean zip dev help

# Extract version from manifest.json
VERSION := $(shell grep '"version"' manifest.json | head -1 | sed 's/.*"version": *"\(.*\)".*/\1/')
ZIP_NAME := memos-notes-v$(VERSION).zip
DIST_DIR := dist

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install npm dependencies
	npm install

build: install ## Build the TipTap editor bundle
	npm run build

dev: install ## Watch and rebuild on changes
	npm run watch

clean: ## Remove build artifacts and dist
	rm -rf $(DIST_DIR) *.zip

zip: build clean ## Build and package extension for Chrome Web Store
	@mkdir -p $(DIST_DIR)
	@cp manifest.json $(DIST_DIR)/
	@cp background.js $(DIST_DIR)/
	@cp popup.html $(DIST_DIR)/
	@cp popup.js $(DIST_DIR)/
	@cp popup.css $(DIST_DIR)/
	@mkdir -p $(DIST_DIR)/lib
	@cp lib/editor.bundle.js $(DIST_DIR)/lib/
	@cp lib/marked.min.js $(DIST_DIR)/lib/
	@cp lib/purify.min.js $(DIST_DIR)/lib/
	@mkdir -p $(DIST_DIR)/icons
	@cp icons/icon16.png $(DIST_DIR)/icons/
	@cp icons/icon48.png $(DIST_DIR)/icons/
	@cp icons/icon128.png $(DIST_DIR)/icons/
	@cd $(DIST_DIR) && zip -r ../$(ZIP_NAME) . -x "*.DS_Store"
	@rm -rf $(DIST_DIR)
	@echo ""
	@echo "✓ Built $(ZIP_NAME) (v$(VERSION))"
	@echo "  Upload at: https://chrome.google.com/webstore/devconsole"

bump-patch: ## Bump patch version (2.0.0 -> 2.0.1)
	@node -e " \
		const fs = require('fs'); \
		const m = JSON.parse(fs.readFileSync('manifest.json','utf8')); \
		const v = m.version.split('.'); \
		v[2] = parseInt(v[2])+1; \
		m.version = v.join('.'); \
		fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2)+'\n'); \
		console.log('Version bumped to ' + m.version); \
	"

bump-minor: ## Bump minor version (2.0.1 -> 2.1.0)
	@node -e " \
		const fs = require('fs'); \
		const m = JSON.parse(fs.readFileSync('manifest.json','utf8')); \
		const v = m.version.split('.'); \
		v[1] = parseInt(v[1])+1; v[2] = 0; \
		m.version = v.join('.'); \
		fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2)+'\n'); \
		console.log('Version bumped to ' + m.version); \
	"

bump-major: ## Bump major version (2.1.0 -> 3.0.0)
	@node -e " \
		const fs = require('fs'); \
		const m = JSON.parse(fs.readFileSync('manifest.json','utf8')); \
		const v = m.version.split('.'); \
		v[0] = parseInt(v[0])+1; v[1] = 0; v[2] = 0; \
		m.version = v.join('.'); \
		fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2)+'\n'); \
		console.log('Version bumped to ' + m.version); \
	"
